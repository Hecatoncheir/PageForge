import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pageforge/data/repositories/browser_repository.dart';
import 'package:pageforge/domain/models/browser_context.dart';
import 'package:pageforge/domain/models/appearance.dart';
import 'package:pageforge/main.dart';
import 'package:pageforge/ui/home/home_view_model.dart';

void main() {
  testWidgets('Вкладки переключаются в компактном окне без переполнения', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 580);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repository = BrowserRepository(
      loader: () async =>
          const BrowserContext(siteLabel: 'example.com', version: '0.1.0'),
    );
    await tester.pumpWidget(PageForgeApp(repository: repository));
    await tester.pumpAndSettle();
    expect(find.text('example.com'), findsOneWidget);
    expect(find.text('Исходное отображение'), findsOneWidget);
    await tester.tap(find.text('Разработка'));
    await tester.pumpAndSettle();
    expect(find.text('Добавить'), findsOneWidget);
    expect(find.text('Выгрузить'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Отображение'));
    await tester.pumpAndSettle();
    expect(find.text('Исходное отображение'), findsOneWidget);
    expect(tester.takeException(), isNull);
    final start = tester.getCenter(find.text('Отображение'));
    final finish = tester.getCenter(find.text('Разработка'));
    await tester.dragFrom(start, finish - start);
    await tester.pumpAndSettle();
    expect(find.text('Добавить'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('Ошибка браузерного API отображается в состоянии интерфейса', () async {
    final model = HomeViewModel(
      BrowserRepository(loader: () async => throw StateError('Недоступно')),
    );
    addTearDown(model.dispose);
    await model.load();
    expect(model.error, 'Не удалось получить сведения о вкладке');
    expect(model.context, isNull);
  });

  for (final size in [const Size(380, 580), const Size(320, 480)]) {
    testWidgets('Карточки и действия помещаются в окно $size', (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final commands = <String>[];
      final repository = BrowserRepository(
        loader: () async => const BrowserContext(
          siteLabel: 'очень-длинное-имя-сайта.example.com',
          version: '0.1.0',
          tabId: 7,
          supported: true,
          isExtension: true,
          selectedId: 'paper',
          originPattern: 'https://example.com/*',
          appearances: [
            Appearance(
              id: 'paper',
              name: 'Очень длинное название оформления',
              version: '1.0.0',
            ),
          ],
        ),
        command: (name, args) async {
          commands.add(name);
          return {};
        },
      );
      await tester.pumpWidget(PageForgeApp(repository: repository));
      await tester.pumpAndSettle();
      expect(
        find.byTooltip('Выгрузить Очень длинное название оформления'),
        findsOneWidget,
      );
      await tester.tap(
        find.byTooltip('Удалить Очень длинное название оформления'),
      );
      await tester.pumpAndSettle();
      expect(commands, contains('delete'));
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Разработка'));
      await tester.pumpAndSettle();
      expect(find.text('Добавить'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }

  test(
    'Ошибка применения не меняет текущий выбор и снимает блокировку',
    () async {
      final model = HomeViewModel(
        BrowserRepository(
          loader: () async => const BrowserContext(
            siteLabel: 'example.com',
            version: '0.1.0',
            selectedId: 'old',
          ),
          command: (name, arguments) async =>
              throw Exception('Неверное правило'),
        ),
      );
      addTearDown(model.dispose);
      await model.load();
      await model.select('new');
      expect(model.context?.selectedId, 'old');
      expect(model.busy, false);
      expect(model.message, 'Неверное правило');
    },
  );
}
