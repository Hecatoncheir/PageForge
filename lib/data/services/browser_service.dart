import '../../domain/models/browser_context.dart';
import 'browser_service_stub.dart'
    if (dart.library.js_interop) 'browser_service_web.dart'
    as platform;

Future<BrowserContext> readBrowserContext() => platform.readBrowserContext();
