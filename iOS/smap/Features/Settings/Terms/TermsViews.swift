//
// TermsViews.swift
// smap
//
// Extracted from RootCoordinatorView.swift
// Contains: ServiceTermsView, PrivacyPolicyView, LocationTermsView,
//           MarketingConsentView, ThirdPartyProvisionView, TermSection, LegalDocumentView
// 이용약관·위치·제3자·마케팅 본문은 LegalContent.swift(Notion 원문에서 생성)
//

import SwiftUI

// MARK: - Term Section Component

struct TermSection: View {
    @Environment(\.smapAccent) private var accent
    let title: String
    let content: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.suite(size: 18, weight: .bold))
                .foregroundColor(accent.base)

            Text(content)
                .font(.suite(size: 15))
                .lineSpacing(6)
                .foregroundColor(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 18)
        .overlay(alignment: .bottom) { Divider() }
    }
}

// MARK: - 전문 보기 링크

/// 맨 아래에서 웹에 게시한 원문(smap.aiagnt.kr/legal/…)을 연다(표·신고확인증 이미지는 웹에만 있다).
/// (예전 전문은 Notion 페이지에만 있었다. 2026-11-19 웹으로 옮겼다.)
struct LegalFullTextLink: View {
    @Environment(\.smapAccent) private var accent
    /// 웹 경로. 예: "legal/terms" (webBaseURL 은 / 로 끝난다)
    let path: String

    var body: some View {
        if let url = URL(string: AppConfiguration.webBaseURL + path) {
            Link(destination: url) {
                HStack(spacing: 6) {
                    Text("전문 보기")
                        .font(.suite(size: 16, weight: .semibold))
                    Image(systemName: "arrow.up.right.square")
                        .font(.suite(size: 15, weight: .semibold))
                }
                .foregroundColor(accent.base)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(RoundedRectangle(cornerRadius: 12).stroke(accent.base.opacity(0.35), lineWidth: 1))
            }
            .padding(.bottom, 40)
        }
    }
}

// MARK: - 약관 문서 화면 (공용)

/// 약관 문서 데이터(LegalContent.swift)를 그린다. 이용약관·위치기반서비스·제3자 제공·마케팅 4종 공용.
/// 본문은 Notion 원문에서 생성했다(웹 smap.aiagnt.kr/legal/* 과 같은 원문).
struct LegalDocumentView: View {
    @Environment(\.presentationMode) var presentationMode
    let document: LegalDocument

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(document.title)
                        .font(SMAPTheme.Font.pageTitle)
                        .foregroundColor(.primary)
                    if let date = document.effectiveDate {
                        Text("시행일: \(date)")
                            .font(.suite(size: 14))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 20)

                if let intro = document.intro {
                    Text(intro)
                        .font(.suite(size: 15))
                        .lineSpacing(6)
                        .foregroundColor(.primary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                ForEach(Array(document.sections.enumerated()), id: \.offset) { _, section in
                    TermSection(title: section.title, content: section.content)
                }

                LegalFullTextLink(path: document.webPath)
            }
            .padding(.horizontal, 20)
        }
        .background(Color(uiColor: .systemBackground).ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: { presentationMode.wrappedValue.dismiss() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.suite(size: 18, weight: .semibold))
                        Text("뒤로")
                            .font(.suite(size: 18, weight: .bold))
                    }
                    .foregroundColor(.primary)
                }
            }
        }
    }
}

// MARK: - Service Terms View
struct ServiceTermsView: View {
    var body: some View { LegalDocumentView(document: .serviceTerms) }
}

// MARK: - Privacy Policy View
struct PrivacyPolicyView: View {
    @Environment(\.presentationMode) var presentationMode

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("개인정보 처리방침")
                        .font(SMAPTheme.Font.pageTitle)
                        .foregroundColor(.primary)
                    Text("시행일: 2026-01-08")
                        .font(.suite(size: 14))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 20)

                VStack(alignment: .leading, spacing: 20) {
                    Text("비욘드리얼(\"회사\"라 함)는 이용자의 개인정보를 소중하게 생각하며, 『개인정보 보호법』 및 『위치정보의 보호 및 이용 등에 관한 법률』 등 관련 법령을 준수하고 있습니다.")
                        .font(.suite(size: 15)).lineSpacing(6)
                    Text("본 방침은 \"도착했어\" 서비스 이용 시 수집되는 위치 데이터를 포함한 개인정보의 처리 과정을 상세히 공개합니다.")
                        .font(.suite(size: 15)).lineSpacing(6)

                    TermSection(title: "1. 개인정보 수집 항목 및 이용목적", content: "회사는 서비스 제공을 위해 아래와 같은 개인정보 및 기기 액세스 권한을 수집·이용합니다.")

                    // Collection table
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: 0) {
                            Text("구분").font(.suite(size: 13, weight: .bold)).frame(width: 80, alignment: .leading).padding(8)
                            Text("수집 항목").font(.suite(size: 13, weight: .bold)).frame(maxWidth: .infinity, alignment: .leading).padding(8)
                            Text("이용 목적").font(.suite(size: 13, weight: .bold)).frame(maxWidth: .infinity, alignment: .leading).padding(8)
                        }.background(Color.gray.opacity(0.15))
                        Divider()
                        HStack(alignment: .top, spacing: 0) {
                            Text("위치 정보\n(필수)").font(.suite(size: 12, weight: .medium)).frame(width: 80, alignment: .leading).padding(8)
                            Text("실시간 GPS 위치 데이터, 이동 경로, 기기 위치 정보").font(.suite(size: 12)).frame(maxWidth: .infinity, alignment: .leading).padding(8)
                            Text("그룹 내 실시간 위치 공유, 일정 장소 기반 알림, 위치 기반 서비스 제공").font(.suite(size: 12)).frame(maxWidth: .infinity, alignment: .leading).padding(8)
                        }
                        Divider()
                        HStack(alignment: .top, spacing: 0) {
                            Text("회원 정보\n(필수)").font(.suite(size: 12, weight: .medium)).frame(width: 80, alignment: .leading).padding(8)
                            Text("이메일 주소, 비밀번호, 닉네임, 프로필 사진").font(.suite(size: 12)).frame(maxWidth: .infinity, alignment: .leading).padding(8)
                            Text("서비스 가입 및 본인 확인, 사용자 식별").font(.suite(size: 12)).frame(maxWidth: .infinity, alignment: .leading).padding(8)
                        }
                        Divider()
                        HStack(alignment: .top, spacing: 0) {
                            Text("기기 정보\n(필수)").font(.suite(size: 12, weight: .medium)).frame(width: 80, alignment: .leading).padding(8)
                            Text("단말기 식별번호(ID), OS 버전, 방문 기록").font(.suite(size: 12)).frame(maxWidth: .infinity, alignment: .leading).padding(8)
                            Text("서비스 최적화 및 부정 이용 방지").font(.suite(size: 12)).frame(maxWidth: .infinity, alignment: .leading).padding(8)
                        }
                    }
                    .background(SMAPTheme.Adaptive.surface).cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.3), lineWidth: 1))

                    // Important notice
                    VStack(alignment: .leading, spacing: 8) {
                        Text("[중요] 위치 정보 액세스 고지").font(.suite(size: 15, weight: .bold)).foregroundColor(.orange)
                        Text("\"도착했어\"는 앱이 닫혀 있거나 사용 중이 아닐 때도 실시간 위치 공유 기능을 지원하기 위해 위치 데이터를 수집합니다.").font(.suite(size: 14)).lineSpacing(4)
                        Text("이용자가 '항상 허용'으로 설정한 경우에 한해 백그라운드에서 위치 정보를 액세스하며, 이는 그룹 멤버 간의 원활한 일정 및 위치 공유를 위한 핵심 기능입니다.").font(.suite(size: 14)).lineSpacing(4)
                    }
                    .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.orange.opacity(0.1)).cornerRadius(12)
                    .overlay(Rectangle().fill(Color.orange).frame(width: 4), alignment: .leading)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    TermSection(title: "2. 위치정보의 보호 및 이용 (추가)", content: "회사는 위치기반서비스를 제공하기 위해 이용자의 위치정보를 처리하며, 다음과 같은 원칙을 준수합니다.\n\n• 수집 방법: GPS, Wi-Fi, 기기 센서 등을 통해 실시간으로 수집합니다.\n• 보유 및 이용: 이용 목적이 달성되거나 이용자가 동의를 철회할 경우 즉시 파기합니다. 단, 관련 법령에 따라 기록을 보존해야 하는 경우 해당 기간(예: 위치정보 이용·제공사실 확인자료 6개월) 동안 보관합니다.\n• 이용자 권리: 이용자는 언제든지 위치 정보 수집에 대한 동의를 거부하거나 철회할 수 있으며, 이 경우 서비스의 일부(실시간 공유 등) 이용이 제한될 수 있습니다.")
                    TermSection(title: "3. 개인정보의 제3자에 대한 제공", content: "회사는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다.\n\n단, 그룹 공유 기능을 선택하여 이용자가 스스로 위치 정보를 그룹 멤버에게 노출하는 경우는 예외로 합니다.")
                    TermSection(title: "4. 개인정보의 파기", content: "개인정보는 수집 및 이용목적이 달성되면 지체 없이 파기합니다. 전자적 파일 형태는 복구가 불가능한 기술적 방법을 사용하여 삭제합니다.")
                    TermSection(title: "5. 개인정보 보호책임자", content: "회사는 개인정보 및 위치정보와 관련한 고충 처리를 위하여 아래와 같이 책임자를 지정하고 있습니다.")

                    VStack(alignment: .leading, spacing: 8) {
                        Text("개인정보 보호책임자").font(.suite(size: 16, weight: .bold))
                        VStack(alignment: .leading, spacing: 4) {
                            Text("성명: 정진").font(.suite(size: 14))
                            Text("전화: 070-8065-2207").font(.suite(size: 14))
                            Text("이메일: admin@aiagnt.kr").font(.suite(size: 14))
                        }.foregroundStyle(.secondary)
                    }
                    .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.blue.opacity(0.05)).cornerRadius(12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.blue.opacity(0.1), lineWidth: 1))
                }
                .padding(.bottom, 40)
                LegalFullTextLink(path: "legal/privacy")
            }
            .padding(.horizontal, 20)
        }
        .background(Color(uiColor: .systemBackground).ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: { presentationMode.wrappedValue.dismiss() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left").font(.suite(size: 18, weight: .semibold))
                        Text("뒤로").font(.suite(size: 18, weight: .bold))
                    }.foregroundColor(.primary)
                }
            }
        }
    }
}

// MARK: - Location Terms View
struct LocationTermsView: View {
    var body: some View { LegalDocumentView(document: .locationTerms) }
}

// MARK: - Marketing Consent View
struct MarketingConsentView: View {
    var body: some View { LegalDocumentView(document: .marketingConsent) }
}

// MARK: - Third Party Provision View
struct ThirdPartyProvisionView: View {
    var body: some View { LegalDocumentView(document: .thirdPartyProvision) }
}
