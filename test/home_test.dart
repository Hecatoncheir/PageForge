import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pageforge/data/repositories/browser_repository.dart';
import 'package:pageforge/domain/models/browser_context.dart';
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
}
