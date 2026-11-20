import SwiftUI
import CoreImage.CIFilterBuiltins

struct QRCodeView: View {
    let data: String
    let size: CGFloat
    @Environment(\.dismiss) var dismiss
    
    
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("QR 코드로 초대하기").font(SMAPTheme.Font.pageTitle)
                    Text("카메라로 코드를 스캔한 뒤 링크를 눌러 그룹에 참여하세요.")
                        .font(SMAPTheme.Font.secondary).foregroundStyle(.secondary)
                    Image(uiImage: generateQRCode(from: data))
                        .interpolation(.none).resizable().scaledToFit()
                        .frame(maxWidth: size)
                        .padding(20)
                        .background(.white, in: RoundedRectangle(cornerRadius: 16))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                        .background(SMAPAccent.family.container, in: RoundedRectangle(cornerRadius: 20))
                        .accessibilityLabel("그룹 초대 QR 코드")
                    SMAPButton("QR 코드 공유", action: shareQRCode)
                }
                .frame(maxWidth: 520)
                .padding(20)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("QR 코드")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("완료") {
                        dismiss()
                    }
                    .foregroundColor(SMAPAccent.family.base)
                }
            }
        }
    }
    
    func generateQRCode(from string: String) -> UIImage {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        
        filter.message = Data(string.utf8)
        
        if let outputImage = filter.outputImage {
            let transform = CGAffineTransform(scaleX: 10, y: 10)
            let scaledImage = outputImage.transformed(by: transform)
            
            if let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) {
                return UIImage(cgImage: cgImage)
            }
        }
        
        return UIImage(systemName: "xmark.circle") ?? UIImage()
    }
    
    func shareQRCode() {
        let qrImage = generateQRCode(from: data)
        let activityViewController = UIActivityViewController(
            activityItems: [qrImage],
            applicationActivities: nil
        )
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootViewController = windowScene.windows.first?.rootViewController {
            activityViewController.popoverPresentationController?.sourceView = rootViewController.view
            rootViewController.present(activityViewController, animated: true)
        }
    }
}

struct QRCodeView_Previews: PreviewProvider {
    static var previews: some View {
        QRCodeView(data: "https://smap.aiagnt.kr/group/123/join", size: 250)
    }
}
