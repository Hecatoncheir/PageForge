import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/repositories/browser_repository.dart';
import 'home_state.dart';

class HomeCubit extends Cubit<HomeState> {
  HomeCubit(this._repository) : super(const HomeState()) {
    _subscription = _repository.events.listen(_onEvent);
    if (_repository.liveUpdates) {
      _timer = Timer.periodic(const Duration(seconds: 2), (_) => load());
    }
  }

  final BrowserRepository _repository;
  StreamSubscription<Map<String, Object?>>? _subscription;
  Timer? _timer;
  Future<void>? _readTask;
  int _readId = 0;
  bool _closing = false;

  void _publish(HomeState next) {
    if (isClosed || _closing) return;
    final dropChanged = state.canDrop != next.canDrop;
    emit(next);
    if (dropChanged) _setDropEnabled(next.canDrop);
  }

  void _setDropEnabled(bool enabled) {
    unawaited(
      Future.sync(
        () => _repository.execute('drop-enabled', {'enabled': enabled}),
      ).then<void>((_) {}, onError: (Object _, StackTrace _) {}),
    );
  }

  void _invalidateRead() {
    _readId++;
    _readTask = null;
  }

  Future<void> load({bool refreshPreview = false}) {
    if (isClosed || _closing || state.busy) return Future.value();
    final pending = _readTask;
    if (pending != null) return pending;
    final id = ++_readId;
    return _readTask = _read(id, refreshPreview).whenComplete(() {
      if (id == _readId) _readTask = null;
    });
  }

  Future<void> _read(int id, bool refreshPreview) async {
    try {
      final context = await _repository.readContext(
        refreshPreview: refreshPreview,
      );
      if (isClosed || id != _readId) return;
      _publish(state.copyWith(context: context, clearError: true));
    } catch (_) {
      if (isClosed || id != _readId) return;
      _publish(state.copyWith(error: 'Не удалось получить сведения о вкладке'));
    }
  }

  void navigate(HomePage page) =>
      _publish(state.copyWith(page: page, dragging: false));
  void toggleLibrary() =>
      navigate(state.showAll ? HomePage.appearance : HomePage.library);

  void _notice(String value) {
    final message = value.replaceFirst(RegExp(r'^(Exception: |Error: )'), '');
    _publish(state.copyWith(message: message, messageId: state.messageId + 1));
  }

  Future<void> _run(
    Future<Map<String, Object?>> Function() action, {
    bool importing = false,
  }) async {
    if (isClosed || _closing || state.busy) return;
    _invalidateRead();
    _publish(state.copyWith(busy: true));
    try {
      // Вызов API остаётся синхронным до первого await: разрешениям нужен жест пользователя.
      final result = await action();
      if (isClosed) return;
      if (importing && result['cancelled'] != true) {
        navigate(HomePage.appearance);
      }
      if (result['message'] case final String message) _notice(message);
    } catch (error) {
      if (!isClosed) _notice(error.toString());
    } finally {
      _publish(state.copyWith(busy: false));
      await load();
    }
  }

  Future<void> select(String? id) => _run(
    () => _repository.execute('select', {
      'id': id,
      'tabId': state.context?.tabId,
      'originPattern': state.context?.originPattern,
    }),
  );
  Future<void> remove(String id) =>
      _run(() => _repository.execute('delete', {'id': id}));
  Future<void> exportArchive([String? id]) => _run(
    () => _repository.execute('export', {
      'id': id ?? state.context?.selectedId,
      'tabId': state.context?.tabId,
    }),
  );
  Future<void> importArchive() => _run(
    () => _repository.importArchive(state.context?.tabId ?? -1),
    importing: true,
  );
  Future<void> importRepository(String url) => _run(
    () => _repository.execute('import-repository', {
      'url': url.trim(),
      'tabId': state.context?.tabId,
    }),
    importing: true,
  );
  Future<void> checkUpdates() =>
      _run(() => _repository.execute('check-updates', {}));
  Future<void> updateAppearance(String id) => _run(
    () => _repository.execute('update-profile', {
      'id': id,
      'tabId': state.context?.tabId,
    }),
  );
  Future<void> openRelease(String url) =>
      _run(() => _repository.execute('open-release', {'url': url}));
  Future<void> toggleTheme() => _run(
    () => _repository.execute('theme', {
      'theme': state.lightTheme ? 'dark' : 'light',
    }),
  );

  void _onEvent(Map<String, Object?> event) {
    if (isClosed) return;
    switch (event['event']) {
      case 'drag':
        _publish(state.copyWith(dragging: event['value'] == true));
      case 'start':
        _invalidateRead();
        _publish(state.copyWith(busy: true));
      case 'done':
        _finishDrop(event);
    }
  }

  void _finishDrop(Map<String, Object?> event) {
    final imported = event['error'] == null && event['id'] != null;
    _publish(
      state.copyWith(
        busy: false,
        dragging: false,
        page: imported ? HomePage.appearance : state.page,
      ),
    );
    final message = event['error'] ?? event['message'];
    if (message is String) _notice(message);
    unawaited(load());
  }

  @override
  Future<void> close() async {
    _closing = true;
    _timer?.cancel();
    _invalidateRead();
    _setDropEnabled(false);
    await _subscription?.cancel();
    return super.close();
  }
}
