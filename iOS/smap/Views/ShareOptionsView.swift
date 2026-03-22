import SwiftUI
import MessageUI

struct ShareOptionsView: View {
    let group: SmapGroup
    @Binding var isPresented: Bool
    @Binding var showingQRCode: Bool
    @State private var showingMessageCompose = false
    @State private var showingAlert = false
    @State private var alertMessage = ""
    
    
    
    var body: some View {
        NavigationStack {
            List {
                Section(header: Text("그룹 초대 방법").font(.suite(size: 13))) {
                    // 링크 복사
                    Button(action: copyInviteLink) {
                        HStack {
                            Image(systemName: "doc.on.doc")
                                .font(.suite(size: 20))
                                .foregroundColor(SMAPTheme.Color.primary)
                                .frame(width: 30)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("링크 복사")
                                    .font(.suite(size: 16))
                                    .foregroundColor(.primary)
                                Text("초대 링크를 복사합니다")
                                    .font(.suite(size: 12))
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.8)
                            }
                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    // QR 코드 보기
                    Button(action: {
                        showingQRCode = true
                        isPresented = false
                    }) {
                        HStack {
                            Image(systemName: "qrcode")
                                .font(.suite(size: 20))
                                .foregroundColor(SMAPTheme.Color.primary)
                                .frame(width: 30)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("QR 코드 보기")
                                    .font(.suite(size: 16))
                                    .foregroundColor(.primary)
                                Text("QR 코드로 쉽게 초대하세요")
                                    .font(.suite(size: 12))
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.8)
                            }
                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    // 문자로 공유
                    Button(action: shareViaSMS) {
                        HStack {
                            Image(systemName: "message")
                                .font(.suite(size: 20))
                                .foregroundColor(SMAPTheme.Color.primary)
                                .frame(width: 30)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("문자로 공유")
                                    .font(.suite(size: 16))
                                    .foregroundColor(.primary)
                                Text("문자 메시지로 초대 링크를 전송합니다")
                                    .font(.suite(size: 12))
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                            }
                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    // 기본 공유
                    Button(action: shareViaSystem) {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                                .font(.suite(size: 20))
                                .foregroundColor(SMAPTheme.Color.primary)
                                .frame(width: 30)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("기본 공유")
                                    .font(.suite(size: 16))
                                    .foregroundColor(.primary)
                                Text("다양한 앱으로 공유할 수 있습니다")
                                    .font(.suite(size: 12))
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.8)
                            }
                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                
                // 초대 코드 섹션
                if let inviteCode = group.sgt_code, !inviteCode.isEmpty {
                    Section(header: Text("초대 코드").font(.suite(size: 13))) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("복사하여 편한 방법으로 공유하세요.")
                                    .font(.suite(size: 14))
                                    .foregroundColor(.secondary)
                                Text(inviteCode)
                                    .font(.suite(size: 20, weight: .bold))
                                    .foregroundColor(SMAPTheme.Color.primary)
                            }
                            Spacer()
                            Button(action: copyInviteCode) {
                                Image(systemName: "doc.on.doc")
                                    .font(.suite(size: 18))
                                    .foregroundColor(SMAPTheme.Color.primary)
                            }
                            .accessibilityLabel("초대 코드 복사")
                        }
                        .padding(.vertical, 8)
                    }
                }
            }
            .listStyle(InsetGroupedListStyle())
            .navigationTitle("그룹 초대")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("완료") {
                        isPresented = false
                    }
                    .foregroundColor(SMAPTheme.Color.primary)
                }
            }
        }
        .alert("알림", isPresented: $showingAlert) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
        .sheet(isPresented: $showingMessageCompose) {
            MessageComposeView(
                recipients: [],
                body: generateInviteMessage()
            )
        }
    }
    
    // MARK: - Helper Functions
    
    private func generateInviteLink() -> String {
        return "https://nextstep.smap.site/group/\(group.sgt_idx)/join"
    }
    
    private func generateInviteMessage() -> String {
        let inviteLink = generateInviteLink()
        if let inviteCode = group.sgt_code, !inviteCode.isEmpty {
            return "[SMAP] \(group.sgt_title ?? "그룹")에 초대되었습니다!\n\n초대 코드: \(inviteCode)\n\n링크: \(inviteLink)"
        } else {
            return "[SMAP] \(group.sgt_title ?? "그룹")에 초대되었습니다!\n\n링크: \(inviteLink)"
        }
    }
    
    private func copyInviteLink() {
        let inviteLink = generateInviteLink()
        UIPasteboard.general.string = inviteLink
        alertMessage = "초대 링크가 복사되었습니다!"
        showingAlert = true
    }
    
    private func copyInviteCode() {
        if let inviteCode = group.sgt_code {
            UIPasteboard.general.string = inviteCode
            alertMessage = "초대 코드가 복사되었습니다!"
            showingAlert = true
        }
    }
    
    private func shareViaSMS() {
        if MFMessageComposeViewController.canSendText() {
            showingMessageCompose = true
        } else {
            // SMS를 사용할 수 없는 경우 메시지를 클립보드에 복사
            UIPasteboard.general.string = generateInviteMessage()
            alertMessage = "문자 메시지를 사용할 수 없습니다.\n초대 메시지가 클립보드에 복사되었습니다."
            showingAlert = true
        }
    }
    
    private func shareViaSystem() {
        let inviteMessage = generateInviteMessage()
        let activityViewController = UIActivityViewController(
            activityItems: [inviteMessage],
            applicationActivities: nil
        )
        
        // Find the top-most view controller more reliably
        if let topController = findTopViewController() {
            // For iPad support
            if let popover = activityViewController.popoverPresentationController {
                popover.sourceView = topController.view
                popover.sourceRect = CGRect(x: topController.view.bounds.midX, y: topController.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            
            topController.present(activityViewController, animated: true)
        }
    }
    
    // Helper to find the top-most UIViewController
    private func findTopViewController() -> UIViewController? {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              var topController = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            return nil
        }
        
        while let presentedViewController = topController.presentedViewController {
            topController = presentedViewController
        }
        
        return topController
    }
}

// MARK: - Message Compose View

struct MessageComposeView: UIViewControllerRepresentable {
    let recipients: [String]
    let body: String
    
    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let controller = MFMessageComposeViewController()
        controller.recipients = recipients
        controller.body = body
        controller.messageComposeDelegate = context.coordinator
        return controller
    }
    
    func updateUIViewController(_ uiViewController: MFMessageComposeViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
            controller.dismiss(animated: true)
        }
    }
}

struct ShareOptionsView_Previews: PreviewProvider {
    static var previews: some View {
        ShareOptionsView(
            group: SmapGroup(
                sgt_idx: 1,
                sgt_title: "테스트 그룹",
                sgt_code: "ABC123",
                sgt_memo: "테스트 그룹 설명",
                mt_idx: 1,
                member_count: 4,
                sgt_show: "Y",
                sgt_wdate: Date().ISO8601Format()
            ),
            isPresented: .constant(true),
            showingQRCode: .constant(false)
        )
    }
}

