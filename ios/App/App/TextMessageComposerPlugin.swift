import Foundation
import Capacitor
import MessageUI

@objc(TextMessageComposerPlugin)
public class TextMessageComposerPlugin: CAPPlugin, CAPBridgedPlugin, MFMessageComposeViewControllerDelegate {
    public let identifier = "TextMessageComposerPlugin"
    public let jsName = "TextMessageComposerPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "compose", returnType: CAPPluginReturnPromise)
    ]

    @objc func compose(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard MFMessageComposeViewController.canSendText() else {
                call.reject("This device cannot send text messages.")
                return
            }

            let body = call.getString("body") ?? ""
            let recipients = call.getArray("recipients", String.self) ?? []
            let attachmentPaths = call.getArray("attachments", String.self) ?? []

            let composer = MFMessageComposeViewController()
            composer.messageComposeDelegate = self
            composer.body = body
            composer.recipients = recipients

            if MFMessageComposeViewController.canSendAttachments() {
                for path in attachmentPaths {
                    let cleanedPath = path.replacingOccurrences(of: "file://", with: "")
                    let fileURL = URL(fileURLWithPath: cleanedPath)
                    composer.addAttachmentURL(
                        fileURL,
                        withAlternateFilename: fileURL.lastPathComponent
                    )
                }
            }
            self.bridge?.viewController?.present(composer, animated: true, completion: nil)
            call.resolve([
                "presented": true
            ])
        }
    }

    public func messageComposeViewController(
        _ controller: MFMessageComposeViewController,
        didFinishWith result: MessageComposeResult
    ) {
        controller.dismiss(animated: true, completion: nil)
    }
}
