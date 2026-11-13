//
//  StoreKitManager.swift
//  smap
//
//  SMAP 프리미엄 구독 — StoreKit 2 구매·복원, 서버 검증, 구독 상태 보관, 구독 화면.
//  계약: .claude/plans/subscription_contract.md
//
//  새 Swift 파일을 추가하면 프로젝트 파일을 수정해야 해서 우선 이 파일에 함께 둔다.
//  (구독 상태 모델 / StoreKitManager / PremiumView / 제한 안내 모디파이어) — 이후 분리 예정.
//

import Foundation
import StoreKit
import SwiftUI

// MARK: - 구독 상태 모델 (GET /subscriptions/me, POST /subscriptions/verify 응답)

struct SubscriptionLimits: Decodable, Equatable {
    /// nil 이면 무제한
    let max_places: Int?
    let log_retention_days: Int
}

struct SubscriptionStatus: Decodable, Equatable {
    let is_premium: Bool
    /// "month" | "year" | nil
    let plan: String?
    /// "ios" | "android" | "legacy" | nil
    let platform: String?
    /// ISO 8601 UTC, 비구독이면 nil
    let expires_at: String?
    let auto_renew: Bool?
    let in_grace_period: Bool
    let limits: SubscriptionLimits
    let enforcement_enabled: Bool
    /// 구매를 SMAP 회원에 묶는 UUID 문자열(StoreKit appAccountToken). 서버 비밀이 없으면 내려오지 않는다.
    let account_token: String?
}

// MARK: - 구매용 계정 토큰 확보 (순수 로직 — 테스트 가능하도록 StoreKit/싱글턴과 분리)

enum PurchaseAccountToken {
    enum TokenError: Error, Equatable {
        /// 값은 있는데 UUID 형식이 아님 — 서버 버그를 숨기지 않는다.
        case malformed
        /// 로그인 정보가 없어 현재 회원을 알 수 없음
        case notSignedIn
        /// /subscriptions/me 조회 실패
        case fetchFailed
    }

    /// 서버가 내려준 문자열을 UUID 로 변환. 값 없음(nil)은 nil, 있는데 형식이 틀리면 오류.
    static func parse(_ raw: String?) throws -> UUID? {
        guard let raw else { return nil }
        guard let uuid = UUID(uuidString: raw) else { throw TokenError.malformed }
        return uuid
    }

    /// 보관해 둔 상태가 현재 회원의 것일 때만 재사용한다. 회원 식별자를 모르면 재사용하지 않는다.
    static func reusableStatus(cached: SubscriptionStatus?, cachedOwner: Int?, currentMember: Int?) -> SubscriptionStatus? {
        guard let cached, let cachedOwner, let currentMember, cachedOwner == currentMember else { return nil }
        return cached
    }

    /// 구매 직전 토큰 확보. 현재 회원의 보관 상태가 있으면 재사용, 아니면 `fetch` 로 새로 조회.
    /// 조회 실패는 오류(토큰 없이 진행하지 않음), 응답에 토큰이 없는 것은 정상(nil).
    static func resolve(
        cached: SubscriptionStatus?,
        cachedOwner: Int?,
        currentMember: Int?,
        fetch: () async throws -> SubscriptionStatus
    ) async throws -> (token: UUID?, status: SubscriptionStatus) {
        let status: SubscriptionStatus
        if let reusable = reusableStatus(cached: cached, cachedOwner: cachedOwner, currentMember: currentMember) {
            status = reusable
        } else {
            do {
                status = try await fetch()
            } catch {
                throw TokenError.fetchFailed
            }
        }
        return (try parse(status.account_token), status)
    }
}

// MARK: - StoreKitManager

@MainActor
final class StoreKitManager: ObservableObject {
    static let shared = StoreKitManager()

    static let monthProductId = "com.dmonster.smap.sub_month"
    static let yearProductId = "com.dmonster.smap.sub_year"
    private static let productIds: Set<String> = [monthProductId, yearProductId]

    enum PurchaseOutcome {
        case success
        case cancelled
        /// 승인 대기(자녀 계정 구매 요청 등)
        case pending
        /// 결제는 끝났지만 서버 확인이 지연됨 — 거래를 finish 하지 않았고 다음 실행 때 재처리된다.
        case delayed
        case failed(String)
    }

    enum RestoreOutcome {
        case restored
        case nothingToRestore
        case delayed
        case cancelled
        case failed(String)
    }

    private enum TransactionOutcome {
        case verified
        case delayed
        /// 로그인 전이라 서버에 보낼 수 없음 — 로그인 후 재처리
        case deferred
        case rejected(String)
        case unverified
        /// 우리 상품이 아니거나 이미 만료·환불된 거래, 또는 처리 중인 거래
        case ignored
    }

    @Published private(set) var products: [Product] = []
    @Published private(set) var isLoadingProducts = false
    @Published private(set) var productsLoadFailed = false
    @Published private(set) var status: SubscriptionStatus?
    /// `status` 를 받아 둔 시점의 로그인 회원(mt_idx) — 다른 회원의 account_token 재사용 방지
    private var statusOwner: Int?
    @Published private(set) var statusLoadFailed = false
    @Published private(set) var isTrialEligible = false
    @Published private(set) var isProcessing = false
    /// 서버 확인이 지연된 거래가 남아 있음
    @Published private(set) var hasDelayedVerification = false

    private var updatesTask: Task<Void, Never>?
    private var inFlight = Set<UInt64>()
    private var logoutObserver: NSObjectProtocol?

    private init() {
        // 로그아웃 시 이전 계정의 구독 상태가 남지 않도록 비운다.
        logoutObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("logout"), object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.status = nil
                self?.statusOwner = nil
                self?.statusLoadFailed = false
                self?.hasDelayedVerification = false
            }
        }
    }

    // MARK: 시작 / 로그인 후 동기화

    /// 앱 시작 시 호출 — 앱 밖에서 생긴 거래(갱신·환불·Ask to Buy 승인 등)를 받는다.
    func start() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self else { return }
                await self.handle(result)
            }
        }
    }

    /// 로그인된 상태에서 호출 — 상태 조회 후 미완료 거래를 같은 경로로 재처리한다.
    func syncAfterLogin() async {
        await refreshStatus()
        await processUnfinished()
    }

    func processUnfinished() async {
        for await result in StoreKit.Transaction.unfinished {
            await handle(result)
        }
    }

    // MARK: 서버 상태

    func refreshStatus() async {
        guard AuthService.shared.getToken() != nil else { return }
        let owner = AuthService.shared.currentUser?.mt_idx
        do {
            let fetched: SubscriptionStatus = try await APIClient.shared.request(.subscriptionMe)
            status = fetched
            statusOwner = owner
            statusLoadFailed = false
        } catch {
            print("[StoreKit] 구독 상태 조회 실패: \(type(of: error))")
            statusLoadFailed = true
        }
    }

    // MARK: 상품

    func loadProducts() async {
        isLoadingProducts = true
        productsLoadFailed = false
        defer { isLoadingProducts = false }
        do {
            let loaded = try await Product.products(for: Self.productIds)
            guard !loaded.isEmpty else {
                productsLoadFailed = true
                return
            }
            // 연간 → 월간 순서
            products = loaded.sorted { $0.id == Self.yearProductId && $1.id != Self.yearProductId }
            if let subscription = loaded.first?.subscription {
                isTrialEligible = await subscription.isEligibleForIntroOffer
            }
        } catch {
            print("[StoreKit] 상품 조회 실패: \(type(of: error))")
            productsLoadFailed = true
        }
    }

    /// 스토어가 알려 준 무료 체험 안내 문구. 자격이 없으면 nil.
    func trialText(for product: Product) -> String? {
        guard isTrialEligible,
              let offer = product.subscription?.introductoryOffer,
              offer.paymentMode == .freeTrial else { return nil }
        return "\(Self.periodText(offer.period)) 무료 체험"
    }

    static func periodText(_ period: Product.SubscriptionPeriod) -> String {
        switch period.unit {
        case .day: return "\(period.value)일"
        case .week: return period.value == 1 ? "7일" : "\(period.value)주"
        case .month: return "\(period.value)개월"
        case .year: return "\(period.value)년"
        @unknown default: return "\(period.value)"
        }
    }

    // MARK: 구매

    func purchase(_ product: Product) async -> PurchaseOutcome {
        guard !isProcessing else { return .cancelled }
        isProcessing = true
        defer { isProcessing = false }
        let accountToken: UUID?
        do {
            accountToken = try await resolveAccountToken()
        } catch PurchaseAccountToken.TokenError.malformed {
            print("[StoreKit] account_token 형식 오류 — 구매를 시작하지 않습니다.")
            return .failed("계정 정보를 확인하지 못해 결제를 시작할 수 없어요. 문제가 계속되면 문의해 주세요.")
        } catch {
            print("[StoreKit] 계정 토큰 확보 실패: \(error)")
            return .failed("결제를 시작하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.")
        }
        do {
            let options: Set<Product.PurchaseOption> = accountToken.map { [.appAccountToken($0)] } ?? []
            switch try await product.purchase(options: options) {
            case .success(let verification):
                switch await handle(verification) {
                case .verified: return .success
                case .delayed, .deferred: return .delayed
                case .rejected(let message): return .failed(message)
                case .unverified: return .failed("결제 정보를 확인하지 못했어요.")
                case .ignored:
                    await refreshStatus()
                    return status?.is_premium == true ? .success : .delayed
                }
            case .userCancelled:
                return .cancelled
            case .pending:
                return .pending
            @unknown default:
                return .failed("결제를 완료하지 못했어요.")
            }
        } catch {
            if let storeError = error as? StoreKitError, case .userCancelled = storeError { return .cancelled }
            print("[StoreKit] 구매 실패: \(type(of: error))")
            return .failed("결제를 완료하지 못했어요.")
        }
    }

    /// 구매 직전 현재 로그인 회원의 account_token 확보(값이 없으면 nil — 토큰 없이 진행).
    private func resolveAccountToken() async throws -> UUID? {
        guard AuthService.shared.getToken() != nil else { throw PurchaseAccountToken.TokenError.notSignedIn }
        let owner = AuthService.shared.currentUser?.mt_idx
        let result = try await PurchaseAccountToken.resolve(
            cached: status, cachedOwner: statusOwner, currentMember: owner
        ) {
            try await APIClient.shared.request(.subscriptionMe)
        }
        if result.status != status || statusOwner != owner {
            status = result.status
            statusOwner = owner
            statusLoadFailed = false
        }
        return result.token
    }

    // MARK: 복원

    func restore() async -> RestoreOutcome {
        guard !isProcessing else { return .cancelled }
        isProcessing = true
        defer { isProcessing = false }
        do {
            try await AppStore.sync()
        } catch {
            if let storeError = error as? StoreKitError, case .userCancelled = storeError { return .cancelled }
            print("[StoreKit] 복원 동기화 실패: \(type(of: error))")
            return .failed("구독을 복원하지 못했어요.")
        }

        var restored = false
        var delayed = false
        var rejection: String?
        for await result in StoreKit.Transaction.currentEntitlements {
            switch await handle(result) {
            case .verified: restored = true
            case .delayed, .deferred: delayed = true
            case .rejected(let message): rejection = message
            case .unverified, .ignored: break
            }
        }
        if restored { return .restored }
        if let rejection { return .failed(rejection) }
        if delayed { return .delayed }
        return .nothingToRestore
    }

    // MARK: 거래 처리 (서버 검증 → finish)

    @discardableResult
    private func handle(_ result: VerificationResult<StoreKit.Transaction>) async -> TransactionOutcome {
        guard case .verified(let transaction) = result else {
            // 기기 측 서명 검증 실패 — 서버로 보내지 않고 finish 하지 않는다.
            print("[StoreKit] 로컬 검증에 실패한 거래를 무시합니다.")
            return .unverified
        }
        guard Self.productIds.contains(transaction.productID) else { return .ignored }

        // 이미 만료·환불된 거래는 권한을 주지 않으므로 서버 검증 없이 정리한다(반복 재시도 방지).
        // 서버 상태는 App Store 알림과 /subscriptions/me 로 반영된다.
        if transaction.revocationDate != nil || (transaction.expirationDate.map { $0 <= Date() } ?? false) {
            await transaction.finish()
            return .ignored
        }

        guard AuthService.shared.getToken() != nil else { return .deferred }
        guard inFlight.insert(transaction.id).inserted else { return .ignored }
        defer { inFlight.remove(transaction.id) }
        let owner = AuthService.shared.currentUser?.mt_idx

        do {
            // JWS 는 로그에 남기지 않는다.
            let updated: SubscriptionStatus = try await APIClient.shared.request(
                .subscriptionVerify(signedTransaction: result.jwsRepresentation)
            )
            // 서버가 성공을 돌려준 뒤에만 완료 처리한다.
            await transaction.finish()
            status = updated
            statusOwner = owner
            statusLoadFailed = false
            hasDelayedVerification = false
            return .verified
        } catch let error as NetworkError {
            switch error {
            case .conflict(let serverMessage):
                return .rejected(serverMessage ?? "이 구매는 다른 계정에 연결되어 있어요.")
            case .badRequest(let message):
                return .rejected(message ?? "구매를 확인하지 못했어요.")
            case .unauthorized:
                return .deferred
            default:
                // 네트워크 오류, 502/503, 5xx 등 — finish 하지 않고 남겨 둔다.
                print("[StoreKit] 서버 검증 지연: \(error)")
                hasDelayedVerification = true
                return .delayed
            }
        } catch {
            print("[StoreKit] 서버 검증 지연: \(type(of: error))")
            hasDelayedVerification = true
            return .delayed
        }
    }
}

// MARK: - 날짜 표시 헬퍼

private enum PremiumDateText {
    static func display(fromISO iso: String?) -> String? {
        guard let iso else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = withFraction.date(from: iso) ?? plain.date(from: iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy.MM.dd"
        return formatter.string(from: date)
    }
}

// MARK: - SMAP 프리미엄 화면

struct PremiumView: View {
    /// true 이면 시트로 표시(자체 NavigationStack 과 닫기 버튼 포함), false 이면 설정에서 push
    var isModal = false

    @ObservedObject private var store = StoreKitManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var selectedProductId = StoreKitManager.yearProductId
    @State private var notice: Notice?
    @State private var showManageSubscriptions = false

    private struct Notice {
        let message: String
        let tone: SMAPBanner.Tone
    }

    var body: some View {
        if isModal {
            NavigationStack {
                content
                    .toolbar {
                        ToolbarItem(placement: .navigationBarLeading) {
                            Button("닫기") { dismiss() }
                        }
                    }
            }
        } else {
            content
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
                header

                if let notice {
                    SMAPBanner(message: notice.message, tone: notice.tone)
                }
                if store.hasDelayedVerification, notice == nil {
                    SMAPBanner(message: "결제는 완료됐지만 확인이 지연되고 있어요. 잠시 후 자동으로 반영돼요.", tone: .info)
                }

                if let status = store.status, status.is_premium {
                    subscribedSection(status)
                } else {
                    benefitsSection
                    plansSection
                }

                legalSection
            }
            .padding(SMAPTheme.Spacing.md)
        }
        .background(SMAPTheme.Adaptive.pageBackground.ignoresSafeArea())
        .navigationTitle("SMAP 프리미엄")
        .navigationBarTitleDisplayMode(.inline)
        .manageSubscriptionsSheet(isPresented: $showManageSubscriptions)
        .task {
            await store.loadProducts()
            await store.refreshStatus()
        }
    }

    // MARK: 구성 요소

    private var header: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.xs) {
            Text("SMAP 프리미엄")
                .font(SMAPTheme.Font.title)
                .foregroundStyle(SMAPTheme.Color.textPrimary)
            Text("소중한 사람들의 기록을 더 오래, 더 많이.")
                .font(SMAPTheme.Font.secondary)
                .foregroundStyle(SMAPTheme.Color.textSecondary)
        }
    }

    private var benefitsSection: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            benefitRow(icon: "mappin.and.ellipse", title: "내 장소 무제한 등록", detail: "무료는 2개")
            benefitRow(icon: "clock.arrow.circlepath", title: "활동 기록 14일 보기", detail: "무료는 2일")
        }
        .padding(SMAPTheme.Spacing.md)
        .background(SMAPTheme.Adaptive.surface)
        .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.lg))
    }

    private func benefitRow(icon: String, title: String, detail: String) -> some View {
        HStack(spacing: SMAPTheme.Spacing.md) {
            Image(systemName: icon)
                .foregroundStyle(SMAPTheme.Color.primary)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(SMAPTheme.Font.bodyBold)
                    .foregroundStyle(SMAPTheme.Color.textPrimary)
                Text(detail)
                    .font(SMAPTheme.Font.captionSmall)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var plansSection: some View {
        if store.isLoadingProducts && store.products.isEmpty {
            SMAPLoadingView(message: nil)
                .frame(height: 160)
        } else if store.productsLoadFailed {
            SMAPErrorState(
                title: "요금제를 불러오지 못했어요.",
                description: nil,
                onRetry: { Task { await store.loadProducts() } }
            )
            .frame(height: 220)
        } else {
            VStack(spacing: SMAPTheme.Spacing.sm) {
                ForEach(store.products, id: \.id) { product in
                    PlanCard(
                        product: product,
                        isSelected: selectedProductId == product.id,
                        isRecommended: product.id == StoreKitManager.yearProductId,
                        trialText: store.trialText(for: product),
                        onSelect: { selectedProductId = product.id }
                    )
                }
            }

            SMAPButton(
                purchaseButtonTitle,
                isLoading: store.isProcessing,
                isDisabled: selectedProduct == nil
            ) {
                guard let product = selectedProduct else { return }
                Task { await purchase(product) }
            }
        }
    }

    private var selectedProduct: Product? {
        store.products.first { $0.id == selectedProductId }
    }

    private var purchaseButtonTitle: String {
        if let product = selectedProduct, store.trialText(for: product) != nil {
            return "무료 체험 시작하기"
        }
        return "구독 시작하기"
    }

    @ViewBuilder
    private func subscribedSection(_ status: SubscriptionStatus) -> some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            HStack(spacing: SMAPTheme.Spacing.sm) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(SMAPTheme.Color.primary)
                    .accessibilityHidden(true)
                Text("프리미엄 이용 중")
                    .font(SMAPTheme.Font.headline)
                    .foregroundStyle(SMAPTheme.Color.textPrimary)
            }
            if let planText = planLabel(status.plan) {
                Text(planText)
                    .font(SMAPTheme.Font.secondaryMedium)
                    .foregroundStyle(SMAPTheme.Color.textPrimary)
            }
            if let line = renewalLine(status) {
                Text(line)
                    .font(SMAPTheme.Font.caption)
                    .foregroundStyle(SMAPTheme.Color.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(SMAPTheme.Spacing.md)
        .background(SMAPTheme.Adaptive.surface)
        .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.lg))
        .accessibilityElement(children: .combine)

        if status.in_grace_period {
            SMAPBanner(message: "결제에 문제가 있어요. 결제 수단을 확인해 주세요. 확인되면 이용이 계속돼요.", tone: .error)
        }

        switch status.platform {
        case "ios":
            SMAPButton("구독 관리", style: .outline) { showManageSubscriptions = true }
        case "android":
            Text("이 구독은 Google Play에서 결제됐어요. 변경·해지는 해당 스토어에서 할 수 있어요.")
                .font(SMAPTheme.Font.caption)
                .foregroundStyle(SMAPTheme.Color.textSecondary)
        case "legacy":
            // 계약에 없는 문구 — 과거 유료 회원 안내(보고서에 기재)
            Text("이전 방식으로 결제한 구독이에요. 만료일까지 프리미엄이 유지돼요.")
                .font(SMAPTheme.Font.caption)
                .foregroundStyle(SMAPTheme.Color.textSecondary)
        default:
            EmptyView()
        }
    }

    private func planLabel(_ plan: String?) -> String? {
        switch plan {
        case "month": return "월간 요금제"
        case "year": return "연간 요금제"
        default: return nil
        }
    }

    private func renewalLine(_ status: SubscriptionStatus) -> String? {
        guard let date = PremiumDateText.display(fromISO: status.expires_at) else { return nil }
        switch status.auto_renew {
        case true?: return "다음 결제일 \(date)"
        case false?: return "\(date)에 종료 예정"
        case nil: return "\(date)까지 이용 가능"
        }
    }

    private var legalSection: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.sm) {
            Text("구독은 기간 종료 24시간 전까지 해지하지 않으면 자동으로 갱신돼요. 결제와 해지는 App Store 계정 설정에서 언제든 관리할 수 있어요.")
                .font(SMAPTheme.Font.captionSmall)
                .foregroundStyle(SMAPTheme.Color.textSecondary)

            HStack(spacing: SMAPTheme.Spacing.md) {
                NavigationLink(destination: ServiceTermsView()) { linkLabel("이용약관") }
                NavigationLink(destination: PrivacyPolicyView()) { linkLabel("개인정보 처리방침") }
                Button {
                    Task { await restore() }
                } label: {
                    linkLabel("구매 복원")
                }
                .disabled(store.isProcessing)
            }
        }
    }

    private func linkLabel(_ title: String) -> some View {
        Text(title)
            .font(SMAPTheme.Font.captionMedium)
            .foregroundStyle(SMAPTheme.Color.primary)
            .frame(minHeight: 44)
    }

    // MARK: 동작

    private func purchase(_ product: Product) async {
        notice = nil
        switch await store.purchase(product) {
        case .success:
            notice = Notice(message: "프리미엄이 시작됐어요.", tone: .success)
        case .cancelled:
            break // 사용자가 취소한 경우 아무것도 표시하지 않는다.
        case .pending:
            notice = Notice(message: "구매 승인을 기다리고 있어요. 승인되면 자동으로 반영돼요.", tone: .info)
        case .delayed:
            notice = Notice(message: "결제는 완료됐지만 확인이 지연되고 있어요. 잠시 후 자동으로 반영돼요.", tone: .info)
        case .failed(let message):
            notice = Notice(message: message, tone: .error)
        }
    }

    private func restore() async {
        notice = nil
        switch await store.restore() {
        case .restored:
            notice = Notice(message: "구독을 복원했어요.", tone: .success)
        case .nothingToRestore:
            notice = Notice(message: "복원할 구독이 없어요.", tone: .info)
        case .delayed:
            notice = Notice(message: "결제는 완료됐지만 확인이 지연되고 있어요. 잠시 후 자동으로 반영돼요.", tone: .info)
        case .cancelled:
            break
        case .failed(let message):
            notice = Notice(message: message, tone: .error)
        }
    }
}

/// 요금제 카드 — 선택 상태는 색뿐 아니라 체크 아이콘과 테두리 두께로도 구분한다.
private struct PlanCard: View {
    let product: Product
    let isSelected: Bool
    let isRecommended: Bool
    let trialText: String?
    let onSelect: () -> Void

    private var title: String {
        product.subscription?.subscriptionPeriod.unit == .year ? "연간" : "월간"
    }

    private var periodSuffix: String {
        product.subscription?.subscriptionPeriod.unit == .year ? "/년" : "/월"
    }

    /// 연간 요금제의 월 환산 금액 — 스토어 통화 형식으로 표시(가격을 코드에 쓰지 않는다).
    private var monthlyEquivalent: String? {
        guard product.subscription?.subscriptionPeriod.unit == .year else { return nil }
        return "월 \(product.priceFormatStyle.format(product.price / 12)) 상당"
    }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: SMAPTheme.Spacing.md) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isSelected ? SMAPTheme.Color.primary : SMAPTheme.Color.textSecondary)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: SMAPTheme.Spacing.sm) {
                        Text(title)
                            .font(SMAPTheme.Font.bodyBold)
                            .foregroundStyle(SMAPTheme.Color.textPrimary)
                        if isRecommended {
                            Text("추천")
                                .font(SMAPTheme.Font.captionSmall)
                                .foregroundStyle(SMAPTheme.Color.white)
                                .padding(.horizontal, SMAPTheme.Spacing.sm)
                                .padding(.vertical, 2)
                                .background(SMAPTheme.Color.primary)
                                .clipShape(Capsule())
                        }
                    }
                    if let trialText {
                        Text("\(trialText) 후")
                            .font(SMAPTheme.Font.captionSmall)
                            .foregroundStyle(SMAPTheme.Color.textSecondary)
                    }
                    if let monthlyEquivalent {
                        Text(monthlyEquivalent)
                            .font(SMAPTheme.Font.captionSmall)
                            .foregroundStyle(SMAPTheme.Color.textSecondary)
                    }
                }

                Spacer(minLength: 0)

                Text("\(product.displayPrice)\(periodSuffix)")
                    .font(SMAPTheme.Font.bodyBold)
                    .foregroundStyle(SMAPTheme.Color.textPrimary)
            }
            .padding(SMAPTheme.Spacing.md)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(SMAPTheme.Adaptive.surface)
            .clipShape(RoundedRectangle(cornerRadius: SMAPTheme.Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: SMAPTheme.Radius.lg)
                    .stroke(isSelected ? SMAPTheme.Color.primary : SMAPTheme.Color.border,
                            lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : [.isButton])
    }

    private var accessibilityText: String {
        var parts = [title, "\(product.displayPrice)\(periodSuffix)"]
        if isRecommended { parts.append("추천") }
        if let trialText { parts.append("\(trialText) 후") }
        parts.append(isSelected ? "선택됨" : "선택 안 됨")
        return parts.joined(separator: ", ")
    }
}

// MARK: - 제한 안내 (403 PLACE_LIMIT_EXCEEDED / LOG_RETENTION_EXCEEDED)

private struct SubscriptionLimitAlertModifier: ViewModifier {
    @Binding var message: String?
    @State private var showPremium = false

    func body(content: Content) -> some View {
        content
            .alert("프리미엄 안내", isPresented: Binding(
                get: { message != nil },
                set: { if !$0 { message = nil } }
            )) {
                Button("프리미엄 알아보기") { showPremium = true }
                Button("닫기", role: .cancel) { }
            } message: {
                Text(message ?? "")
            }
            .sheet(isPresented: $showPremium) {
                PremiumView(isModal: true)
            }
    }
}

extension View {
    /// 서버가 구독 제한(403)을 돌려줄 때의 안내. `message` 가 설정되면 "프리미엄 알아보기"가 있는 알림을 띄운다.
    func subscriptionLimitAlert(message: Binding<String?>) -> some View {
        modifier(SubscriptionLimitAlertModifier(message: message))
    }
}
