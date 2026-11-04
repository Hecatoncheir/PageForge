import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../data/repositories/browser_repository.dart';
import '../../domain/models/browser_context.dart';
import '../../domain/models/appearance.dart';

class HomeViewModel extends ChangeNotifier {
  HomeViewModel(this._repository) {
    _subscription = _repository.events.listen(_onEvent);
    if (_repository.liveUpdates) {
      _timer = Timer.periodic(
        const Duration(seconds: 2),
        (_) => load(silent: true),
      );
    }
  }

  final BrowserRepository _repository;
  BrowserContext? context;
  String? error;
  bool _disposed = false;
  bool _loading = false;
  bool busy = false;
  bool dragging = false;
  String? message;
  int messageId = 0;
  Timer? _timer;
  StreamSubscription<Map<String, Object?>>? _subscription;

  bool get lightTheme => context?.theme == 'light';

  String get selectedName {
    for (final appearance in context?.appearances ?? const <Appearance>[]) {
      if (appearance.id == context?.selectedId) return appearance.name;
    }
    return 'Основа для текущего сайта';
  }

  Future<void> load({bool silent = false, bool refreshPreview = false}) async {
    if (_loading || busy || _disposed) return;
    _loading = true;
    try {
      context = await _repository.readContext(refreshPreview: refreshPreview);
      error = null;
    } catch (_) {
      error = 'Не удалось получить сведения о вкладке';
    } finally {
      _loading = false;
    }
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _showMessage(String value) {
    message = value.replaceFirst(RegExp(r'^(Exception: |Error: )'), '');
    messageId += 1;
  }

  Future<void> _run(Future<Map<String, Object?>> Function() action) async {
    if (busy) return;
    busy = true;
    _notify();
    try {
      final result = await action();
      if (result['message'] case final String value) _showMessage(value);
    } catch (exception) {
      _showMessage(exception.toString());
    } finally {
      busy = false;
      await load();
      _notify();
    }
  }

  Future<void> select(String? id) => _run(
    () => _repository.execute('select', {
      'id': id,
      'tabId': context?.tabId,
      'originPattern': context?.originPattern,
    }),
  );

  Future<void> remove(String id) =>
      _run(() => _repository.execute('delete', {'id': id}));
  Future<void> exportArchive([String? id]) => _run(
    () => _repository.execute('export', {
      'id': id ?? context?.selectedId,
      'tabId': context?.tabId,
    }),
  );
  Future<void> importArchive() =>
      _run(() => _repository.importArchive(context?.tabId ?? -1));
  Future<void> importRepository(String url) => _run(
    () => _repository.execute('import-repository', {
      'url': url.trim(),
      'tabId': context?.tabId,
    }),
  );
  Future<void> checkUpdates() =>
      _run(() => _repository.execute('check-updates', {}));
  Future<void> openRelease(String url) =>
      _run(() => _repository.execute('open-release', {'url': url}));
  Future<void> toggleTheme() => _run(
    () =>
        _repository.execute('theme', {'theme': lightTheme ? 'dark' : 'light'}),
  );
  void developmentMode(bool enabled) {
    unawaited(_repository.execute('drop-enabled', {'enabled': enabled}));
  }

  void _onEvent(Map<String, Object?> event) {
    if (event['event'] == 'drag') dragging = event['value'] == true;
    if (event['event'] == 'start') busy = true;
    if (event['event'] == 'done') {
      busy = false;
      final value = event['error'] ?? event['message'];
      if (value is String) _showMessage(value);
      unawaited(load());
    }
    _notify();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    unawaited(_subscription?.cancel());
    super.dispose();
  }
}
