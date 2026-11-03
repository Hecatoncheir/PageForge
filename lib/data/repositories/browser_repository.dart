import '../../domain/models/browser_context.dart';
import '../services/browser_service.dart';

class BrowserRepository {
  BrowserRepository({Future<BrowserContext> Function()? loader})
    : _loader = loader ?? readBrowserContext;

  final Future<BrowserContext> Function() _loader;

  Future<BrowserContext> readContext() => _loader();
}
