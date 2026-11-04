import 'package:collection/collection.dart';

import '../../domain/models/appearance.dart';
import '../../domain/models/browser_context.dart';

enum HomePage { appearance, development, library }

class HomeState {
  const HomeState({
    this.context,
    this.error,
    this.busy = false,
    this.dragging = false,
    this.page = HomePage.appearance,
    this.message,
    this.messageId = 0,
  });

  final BrowserContext? context;
  final String? error;
  final bool busy;
  final bool dragging;
  final HomePage page;
  final String? message;
  final int messageId;

  bool get lightTheme => context?.theme == 'light';
  bool get showAll => page == HomePage.library;
  HomePage get tab => page == HomePage.development ? page : HomePage.appearance;
  bool get canManage => context?.isExtension == true && !busy;
  bool get canExport => context?.supported == true && !busy;
  bool get canReset => canExport && context?.selectedId != null;
  bool get canDrop => canManage && page == HomePage.development;
  bool canApply(Appearance appearance) => canExport && appearance.compatible;

  String get selectedName =>
      context?.appearances
          .firstWhereOrNull(
            (appearance) => appearance.id == context?.selectedId,
          )
          ?.name ??
      'Основа для текущего сайта';

  String get scopeLabel {
    if (showAll) return 'Все сайты';
    if (context?.supported == true) return 'Только для этого сайта';
    return 'Откройте сайт в браузере';
  }

  HomeState copyWith({
    BrowserContext? context,
    String? error,
    bool clearError = false,
    bool? busy,
    bool? dragging,
    HomePage? page,
    String? message,
    int? messageId,
  }) => HomeState(
    context: context ?? this.context,
    error: clearError ? null : error ?? this.error,
    busy: busy ?? this.busy,
    dragging: dragging ?? this.dragging,
    page: page ?? this.page,
    message: message ?? this.message,
    messageId: messageId ?? this.messageId,
  );
}
