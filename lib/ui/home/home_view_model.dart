import 'package:flutter/foundation.dart';

import '../../data/repositories/browser_repository.dart';
import '../../domain/models/browser_context.dart';

class HomeViewModel extends ChangeNotifier {
  HomeViewModel(this._repository);

  final BrowserRepository _repository;
  BrowserContext? context;
  String? error;
  bool _disposed = false;

  Future<void> load() async {
    try {
      context = await _repository.readContext();
      error = null;
    } catch (_) {
      error = 'Не удалось получить сведения о вкладке';
    }
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
