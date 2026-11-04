import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:pageforge/data/repositories/browser_repository.dart';
import 'package:pageforge/domain/models/browser_context.dart';
import 'package:pageforge/ui/home/home_cubit.dart';
import 'package:pageforge/ui/home/home_state.dart';

const initial = BrowserContext(
  siteLabel: 'example.com',
  version: '0.2.0',
  tabId: 7,
  supported: true,
  isExtension: true,
  selectedId: 'old',
);
const updated = BrowserContext(
  siteLabel: 'example.com',
  version: '0.2.0',
  selectedId: 'new',
);

class EventRepository extends BrowserRepository {
  EventRepository({required super.loader, super.command, this.importer});
  final Future<Map<String, Object?>> Function()? importer;
  final controller = StreamController<Map<String, Object?>>.broadcast(
    sync: true,
  );

  @override
  Stream<Map<String, Object?>> get events => controller.stream;

  @override
  Future<Map<String, Object?>> importArchive(int tabId) => importer!();
}

void main() {
  test('Одновременные обновления используют один запрос', () async {
    final response = Completer<BrowserContext>();
    var requests = 0;
    final cubit = HomeCubit(
      BrowserRepository(
        loader: () {
          requests++;
          return response.future;
        },
      ),
    );
    addTearDown(cubit.close);
    final first = cubit.load();
    final second = cubit.load();
    expect(requests, 1);
    response.complete(initial);
    await Future.wait([first, second]);
    expect(cubit.state.context, initial);
  });

  test('Запоздавший опрос не отменяет результат действия', () async {
    final stale = Completer<BrowserContext>();
    var requests = 0;
    final cubit = HomeCubit(
      BrowserRepository(
        loader: () => ++requests == 1 ? stale.future : Future.value(updated),
        command: (_, _) async => {},
      ),
    );
    addTearDown(cubit.close);
    final polling = cubit.load();
    await cubit.select('new');
    expect(cubit.state.context?.selectedId, 'new');
    stale.complete(initial);
    await polling;
    expect(cubit.state.context?.selectedId, 'new');
    expect(cubit.state.busy, false);
  });

  test(
    'Повторное действие блокируется, API вызывается до первого ожидания',
    () async {
      final response = Completer<Map<String, Object?>>();
      final calls = <String>[];
      final cubit = HomeCubit(
        BrowserRepository(
          loader: () async => initial,
          command: (name, _) {
            calls.add(name);
            return response.future;
          },
        ),
      );
      addTearDown(cubit.close);
      await cubit.load();
      final action = cubit.select('new');
      expect(calls, ['select']);
      expect(cubit.state.busy, true);
      await cubit.remove('old');
      expect(calls, ['select']);
      response.complete({});
      await action;
      expect(cubit.state.busy, false);
    },
  );

  test(
    'Успешный импорт переключает вкладку независимо от текста сообщения',
    () async {
      final cubit = HomeCubit(
        BrowserRepository(
          loader: () async => initial,
          command: (_, _) async => {'message': 'Произвольный текст'},
        ),
      );
      addTearDown(cubit.close);
      await cubit.load();
      cubit.navigate(HomePage.development);
      await cubit.importRepository(' https://github.com/owner/repo ');
      expect(cubit.state.page, HomePage.appearance);
      expect(cubit.state.message, 'Произвольный текст');
    },
  );

  test('Отмена выбора файла сохраняет вкладку разработки', () async {
    final repository = EventRepository(
      loader: () async => initial,
      command: (_, _) async => {},
      importer: () async => {'cancelled': true},
    );
    final cubit = HomeCubit(repository);
    addTearDown(repository.controller.close);
    addTearDown(cubit.close);
    await cubit.load();
    cubit.navigate(HomePage.development);
    await cubit.importArchive();
    expect(cubit.state.page, HomePage.development);
    expect(cubit.state.canDrop, true);
    expect(cubit.state.messageId, 0);
  });

  test(
    'Ошибка импорта сохраняет вкладку и разрешает следующую попытку',
    () async {
      final cubit = HomeCubit(
        BrowserRepository(
          loader: () async => initial,
          command: (_, _) async => throw Exception('Неверный ZIP'),
        ),
      );
      addTearDown(cubit.close);
      await cubit.load();
      cubit.navigate(HomePage.development);
      await cubit.importRepository('https://github.com/owner/repo');
      expect(cubit.state.page, HomePage.development);
      expect(cubit.state.busy, false);
      expect(cubit.state.canDrop, true);
      expect(cubit.state.message, 'Неверный ZIP');
    },
  );

  test(
    'Перетаскивание блокируется во время импорта и завершается выбором',
    () async {
      final drop = <bool>[];
      final repository = EventRepository(
        loader: () async => initial,
        command: (name, args) async {
          if (name == 'drop-enabled') drop.add(args['enabled']! as bool);
          return {};
        },
      );
      final cubit = HomeCubit(repository);
      addTearDown(repository.controller.close);
      addTearDown(cubit.close);
      await cubit.load();
      cubit.navigate(HomePage.development);
      repository.controller.add({'event': 'drag', 'value': true});
      expect(cubit.state.dragging, true);
      repository.controller.add({'event': 'start'});
      expect(cubit.state.busy, true);
      expect(cubit.state.canDrop, false);
      repository.controller.add({'event': 'done', 'id': 'new'});
      expect(cubit.state.busy, false);
      expect(cubit.state.dragging, false);
      expect(cubit.state.page, HomePage.appearance);
      expect(drop, [true, false]);
      await cubit.load();
    },
  );

  test(
    'Ошибка перетаскивания оставляет область доступной для повторения',
    () async {
      final repository = EventRepository(
        loader: () async => initial,
        command: (_, _) async => {},
      );
      final cubit = HomeCubit(repository);
      addTearDown(repository.controller.close);
      addTearDown(cubit.close);
      await cubit.load();
      cubit.navigate(HomePage.development);
      repository.controller.add({'event': 'start'});
      repository.controller.add({'event': 'done', 'error': 'Ошибка ZIP'});
      expect(cubit.state.page, HomePage.development);
      expect(cubit.state.canDrop, true);
      expect(cubit.state.message, 'Ошибка ZIP');
      await cubit.load();
    },
  );

  test(
    'Закрытие отменяет подписку и игнорирует незавершённые ответы',
    () async {
      final response = Completer<BrowserContext>();
      final repository = EventRepository(
        loader: () => response.future,
        command: (_, _) async => {},
      );
      addTearDown(repository.controller.close);
      final cubit = HomeCubit(repository);
      final reading = cubit.load();
      expect(repository.controller.hasListener, true);
      await cubit.close();
      response.complete(initial);
      await reading;
      expect(repository.controller.hasListener, false);
      expect(cubit.state.context, isNull);
      expect(cubit.isClosed, true);
    },
  );

  test('Действие может завершиться после закрытия без нового опроса', () async {
    final response = Completer<Map<String, Object?>>();
    var reads = 0;
    final cubit = HomeCubit(
      BrowserRepository(
        loader: () async {
          reads++;
          return initial;
        },
        command: (name, _) =>
            name == 'select' ? response.future : Future.value({}),
      ),
    );
    await cubit.load();
    final action = cubit.select('new');
    await cubit.close();
    final closedState = cubit.state;
    response.complete({'message': 'Готово'});
    await action;
    expect(cubit.state, same(closedState));
    expect(reads, 1);
  });

  for (final synchronous in [true, false]) {
    test(
      'Ошибка отключения перетаскивания не мешает закрытию ($synchronous)',
      () async {
        final cubit = HomeCubit(
          BrowserRepository(
            loader: () async => initial,
            command: (_, _) {
              if (synchronous) throw StateError('Недоступно');
              return Future.error(StateError('Недоступно'));
            },
          ),
        );
        await cubit.load();
        cubit.navigate(HomePage.development);
        await cubit.close();
        expect(cubit.isClosed, true);
      },
    );
  }
}
