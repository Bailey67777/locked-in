// Hugo for Mac: the web app in a window of its own, with no browser around it. No address bar, no title strip,
// no extensions or profile buttons: just the page, with the window's three buttons floating over its top-left corner.
// Build with ./build.sh (needs only the Command Line Tools).
import Cocoa
import WebKit

let home = URL(string: "https://locked-in-inky.vercel.app/")!

/// The empty strip along the top of the page: drag the window by it, double-click to zoom.
final class DragStrip: NSView {
    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2 { window?.zoom(nil) } else { window?.performDrag(with: event) }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var web: WKWebView!
    let barHeight: CGFloat = 28

    func applicationDidFinishLaunching(_ note: Notification) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // sign-ins, the chosen look and the photo code are kept between launches
        // The page keeps its top clear for the window's buttons, the way it does for a phone's notch.
        let css = ".pt-safe{padding-top:\(Int(barHeight))px !important}"
        config.userContentController.addUserScript(WKUserScript(source: "var s=document.createElement('style');s.textContent='\(css)';document.documentElement.appendChild(s);", injectionTime: .atDocumentEnd, forMainFrameOnly: true))

        web = WKWebView(frame: .zero, configuration: config)
        web.uiDelegate = self
        web.navigationDelegate = self
        web.setValue(false, forKey: "drawsBackground") // no white flash before the page paints
        web.allowsBackForwardNavigationGestures = false

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 480, height: 900), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
        window.title = "Hugo"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(red: 0.027, green: 0.043, blue: 0.078, alpha: 1)
        window.minSize = NSSize(width: 360, height: 560)
        window.isReleasedWhenClosed = false

        let content = NSView()
        web.translatesAutoresizingMaskIntoConstraints = false
        let strip = DragStrip()
        strip.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(web)
        content.addSubview(strip)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: content.leadingAnchor), web.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            web.topAnchor.constraint(equalTo: content.topAnchor), web.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            strip.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 78), strip.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            strip.topAnchor.constraint(equalTo: content.topAnchor), strip.heightAnchor.constraint(equalToConstant: barHeight),
        ])
        window.contentView = content
        window.center()
        window.setFrameAutosaveName("HugoMain")
        window.makeKeyAndOrderFront(nil)
        web.load(URLRequest(url: home))
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { window.makeKeyAndOrderFront(nil) }
        return true
    }

    @objc func reload(_ sender: Any?) { web.reload() }

    // A link that leaves Hugo (the replan chat) opens in the browser, or the app that owns it.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        if navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url, url.host != home.host {
            NSWorkspace.shared.open(url)
            return .cancel
        }
        return .allow
    }

    // The microphone (journal) and camera (photos): macOS asks once; after that Hugo's own page is allowed.
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType) async -> WKPermissionDecision {
        origin.host == home.host ? .grant : .deny
    }

    // Choosing photos already on the Mac.
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo) async -> [URL]? {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        return await panel.beginSheetModal(for: window) == .OK ? panel.urls : nil
    }
}

/// The menu bar: Quit, Reload, and Edit (without it, copy and paste don't work in the page's text boxes).
@MainActor
func mainMenu(_ delegate: AppDelegate) -> NSMenu {
    let bar = NSMenu()
    let app = NSMenu()
    app.addItem(withTitle: "About Hugo", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    app.addItem(.separator())
    let reload = app.addItem(withTitle: "Reload", action: #selector(AppDelegate.reload(_:)), keyEquivalent: "r")
    reload.target = delegate
    app.addItem(.separator())
    app.addItem(withTitle: "Hide Hugo", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    app.addItem(withTitle: "Quit Hugo", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    let edit = NSMenu(title: "Edit")
    edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
    edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
    edit.addItem(.separator())
    edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    let win = NSMenu(title: "Window")
    win.addItem(withTitle: "Minimise", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    win.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    for menu in [app, edit, win] {
        let item = NSMenuItem()
        item.submenu = menu
        bar.addItem(item)
    }
    return bar
}

MainActor.assumeIsolated {
    let application = NSApplication.shared
    let delegate = AppDelegate()
    application.delegate = delegate
    application.setActivationPolicy(.regular)
    application.mainMenu = mainMenu(delegate)
    application.run()
}
