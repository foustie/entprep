import Foundation
import Capacitor
import AuthenticationServices

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    private var call: CAPPluginCall?
    private var currentNonce: String?

    @objc func authorize(_ call: CAPPluginCall) {
        self.call = call
        self.currentNonce = call.getString("nonce") ?? ""

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.email, .fullName]
        request.nonce = currentNonce

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self

        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return self.bridge?.webView?.window ?? UIWindow()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            call?.reject("Invalid credential type")
            return
        }

        let identityToken = credential.identityToken.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let authorizationCode = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""

        var result: [String: Any] = [
            "identityToken": identityToken,
            "authorizationCode": authorizationCode,
            "user": credential.user
        ]

        if let email = credential.email {
            result["email"] = email
        }
        if let givenName = credential.fullName?.givenName {
            result["givenName"] = givenName
        }
        if let familyName = credential.fullName?.familyName {
            result["familyName"] = familyName
        }

        call?.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        call?.reject(error.localizedDescription)
    }
}
