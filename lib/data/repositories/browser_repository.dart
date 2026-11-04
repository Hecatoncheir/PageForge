import '../../domain/models/browser_context.dart';
import '../services/browser_service.dart';

class BrowserRepository {
  BrowserRepository({
    this.loader,
    Future<Map<String, Object?>> Function(String, Map<String, Object?>)?
    command,
  }) : _command = command ?? executeBrowserCommand;

  final Future<BrowserContext> Function()? loader;
  final Future<Map<String, Object?>> Function(String, Map<String, Object?>)
  _command;

  bool get liveUpdates => loader == null;
  Stream<Map<String, Object?>> get events =>
      liveUpdates ? browserEvents : const Stream.empty();

  Future<BrowserContext> readContext({bool refreshPreview = false}) =>
      loader?.call() ?? readBrowserContext(refreshPreview: refreshPreview);
  Future<Map<String, Object?>> execute(
    String command,
    Map<String, Object?> arguments,
  ) => _command(command, arguments);
  Future<Map<String, Object?>> importArchive(int tabId) => chooseArchive(tabId);
}
