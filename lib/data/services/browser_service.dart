import '../../domain/models/browser_context.dart';
import 'browser_service_stub.dart'
    if (dart.library.js_interop) 'browser_service_web.dart'
    as platform;

Future<BrowserContext> readBrowserContext({bool refreshPreview = false}) async {
  return BrowserContext.fromJson(
    await platform.execute('state', {'refreshPreview': refreshPreview}),
  );
}

Future<Map<String, Object?>> executeBrowserCommand(
  String command,
  Map<String, Object?> arguments,
) => platform.execute(command, arguments);

Future<Map<String, Object?>> chooseArchive(int tabId) =>
    platform.chooseArchive(tabId);

Stream<Map<String, Object?>> get browserEvents => platform.events;
