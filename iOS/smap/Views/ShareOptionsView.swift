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
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    SMAPFamilyCover(image: "LoginArrivalDoorway", minHeight: 136) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("그룹 초대").font(SMAPTheme.Font.captionBold)
                            Text(group.sgt_title ?? "그룹").font(SMAPTheme.Font.pageTitle)
                        }
                    }
                    if let code = group.sgt_code, !code.isEmpty {
                        Button(action: copyInviteCode) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("초대 코드").font(SMAPTheme.Font.captionBold)
                                    Text(code).font(.suite(size: 24, weight: .bold))
                                }
                                Spacer()
                                Image(systemName: "doc.on.doc")
                            }
                            .padding(16)
                            .foregroundStyle(SMAPAccent.family.deep)
                            .background(SMAPAccent.family.container, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .accessibilityLabel("초대 코드 복사, \(code)")
                    }
                    VStack(spacing: 0) {
                        shareRow("링크 복사", icon: "link", action: copyInviteLink)
                        Divider()
                        shareRow("QR 코드 보기", icon: "qrcode") {
                            showingQRCode = true
                            isPresented = false
                        }
                        Divider()
                        shareRow("문자로 공유", icon: "message", action: shareViaSMS)
                        Divider()
                        shareRow("기본 공유", icon: "square.and.arrow.up", action: shareViaSystem)
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: 520)
                .padding(20)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("그룹 초대")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("완료") {
                        isPresented = false
                    }
                    .foregroundColor(SMAPAccent.family.base)
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
    
    private func shareRow(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                SMAPRowIcon(systemImage: icon)
                Text(title).font(SMAPTheme.Font.bodyBold)
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
            }
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
    }

    private func generateInviteLink() -> String {
        return group.inviteLink
    }
    
    private func generateInviteMessage() -> String {
        let inviteLink = generateInviteLink()
        if let inviteCode = group.sgt_code, !inviteCode.isEmpty {
            return "[도착했어] \(group.sgt_title ?? "그룹")에 초대되었습니다!\n\n초대 코드: \(inviteCode)\n\n링크: \(inviteLink)"
        } else {
            return "[도착했어] \(group.sgt_title ?? "그룹")에 초대되었습니다!\n\n링크: \(inviteLink)"
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

extension SmapGroup {
    var inviteLink: String {
        var components = URLComponents(string: "https://smap.aiagnt.kr/group/\(sgt_idx)/join")!
        if let code = sgt_code, !code.isEmpty { components.queryItems = [URLQueryItem(name: "code", value: code)] }
        return components.string!
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

