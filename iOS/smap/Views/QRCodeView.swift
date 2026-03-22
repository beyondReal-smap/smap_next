import SwiftUI
import CoreImage.CIFilterBuiltins

struct QRCodeView: View {
    let data: String
    let size: CGFloat
    @Environment(\.dismiss) var dismiss
    
    
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                
                // QR Code Title
                VStack(spacing: 8) {
                    Text("QR 코드로 초대하기")
                        .font(.suite(size: 24, weight: .bold))
                        .foregroundColor(.primary)
                    
                    Text("QR 코드를 스캔하여 그룹에 참여하세요")
                        .font(.suite(size: 14))
                        .foregroundColor(.secondary)
                }
                
                // QR Code
                Image(uiImage: generateQRCode(from: data))
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: size, height: size)
                    .padding(20)
                    .background(Color.white)
                    .cornerRadius(20)
                    .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
                
                // Instructions
                VStack(spacing: 12) {
                    HStack(spacing: 12) {
                        Image(systemName: "1.circle.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(SMAPTheme.Color.primary)
                        Text("카메라 앱을 열어주세요")
                            .font(.suite(size: 14))
                            .foregroundColor(.gray)
                        Spacer()
                    }
                    
                    HStack(spacing: 12) {
                        Image(systemName: "2.circle.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(SMAPTheme.Color.primary)
                        Text("QR 코드를 스캔해주세요")
                            .font(.suite(size: 14))
                            .foregroundColor(.gray)
                        Spacer()
                    }
                    
                    HStack(spacing: 12) {
                        Image(systemName: "3.circle.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(SMAPTheme.Color.primary)
                        Text("링크를 탭하여 그룹에 참여하세요")
                            .font(.suite(size: 14))
                            .foregroundColor(.gray)
                        Spacer()
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)
                
                Spacer()
                
                // Share Button
                Button(action: shareQRCode) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                            .font(.suite(size: 16, weight: .semibold))
                        Text("QR 코드 공유")
                            .font(.suite(size: 16, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(SMAPTheme.Color.primary)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 8)
            }
            .navigationTitle("QR 코드")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("완료") {
                        dismiss()
                    }
                    .foregroundColor(SMAPTheme.Color.primary)
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
        QRCodeView(data: "https://nextstep.smap.site/group/123/join", size: 250)
    }
}
