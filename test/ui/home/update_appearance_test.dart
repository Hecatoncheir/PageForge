import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pageforge/data/repositories/browser_repository.dart';
import 'package:pageforge/domain/models/browser_context.dart';
import 'package:pageforge/main.dart';

BrowserContext contextFor({bool installed = false, bool source = true}) =>
    BrowserContext.fromJson({
      'siteLabel': 'other.example',
      'tabId': 7,
      'version': '0.2.1',
      'extension': true,
      'supported': false,
      'library': [
        {
          'id': 'theme',
          'name': 'Gruvbox',
          'version': installed ? '1.0.1' : '1.0.0',
          'siteLabel': 'example.com',
          'compatible': false,
          'selected': true,
          if (source) 'repositoryUrl': 'https://github.com/owner/theme',
          if (source)
            'update': {
              'version': '1.0.1',
              'available': !installed,
              'url': 'https://github.com/owner/theme/releases/tag/v1.0.1',
            },
        },
      ],
    });

void main() {
  for (final size in [const Size(380, 580), const Size(320, 480)]) {
    testWidgets(
      'Обновление другого сайта доступно и сохраняет список «Все» в $size',
      (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final completion = Completer<Map<String, Object?>>();
        final calls = <Map<String, Object?>>[];
        var installed = false;
        final repository = BrowserRepository(
          loader: () async => contextFor(installed: installed),
          command: (name, args) async {
            if (name != 'update-profile') return {};
            calls.add(args);
            final result = await completion.future;
            installed = true;
            return result;
          },
        );
        await tester.pumpWidget(PageForgeApp(repository: repository));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Все'));
        await tester.pumpAndSettle();
        expect(find.textContaining('Новая версия 1.0.1'), findsOneWidget);
        await tester.tap(find.byTooltip('Обновить Gruvbox'));
        await tester.pump();
        expect(calls, [
          {'id': 'theme', 'tabId': 7},
        ]);
        expect(find.byType(LinearProgressIndicator), findsOneWidget);
        expect(
          tester
              .widget<TextButton>(find.widgetWithText(TextButton, 'Обновить'))
              .onPressed,
          isNull,
        );
        expect(tester.takeException(), isNull);
        completion.complete({'message': 'Оформление обновлено до 1.0.1'});
        await tester.pumpAndSettle();
        expect(find.text('Все оформления'), findsOneWidget);
        expect(
          find.textContaining('example.com\nВыбрано\nНовых версий нет'),
          findsOneWidget,
        );
        expect(find.byTooltip('Обновить Gruvbox'), findsNothing);
        expect(find.byType(LinearProgressIndicator), findsNothing);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      },
    );
  }

  testWidgets(
    'Ошибка обновления позволяет повторить попытку из той же карточки',
    (tester) async {
      var attempts = 0;
      var installed = false;
      final repository = BrowserRepository(
        loader: () async => contextFor(installed: installed),
        command: (name, _) async {
          if (name != 'update-profile') return {};
          if (++attempts == 1) throw Exception('Нет сети');
          installed = true;
          return {'message': 'Оформление обновлено до 1.0.1'};
        },
      );
      await tester.pumpWidget(PageForgeApp(repository: repository));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Все'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Обновить Gruvbox'));
      await tester.pumpAndSettle();
      expect(find.text('Нет сети'), findsOneWidget);
      expect(find.text('Все оформления'), findsOneWidget);
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Обновить'))
            .onPressed,
        isNotNull,
      );
      await tester.tap(find.byTooltip('Обновить Gruvbox'));
      await tester.pumpAndSettle();
      expect(attempts, 2);
      expect(find.byTooltip('Обновить Gruvbox'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('Оформление из ZIP без источника не предлагает обновление', (
    tester,
  ) async {
    final repository = BrowserRepository(
      loader: () async => contextFor(source: false),
    );
    await tester.pumpWidget(PageForgeApp(repository: repository));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Все'));
    await tester.pumpAndSettle();
    expect(find.text('Gruvbox'), findsOneWidget);
    expect(find.text('Обновить'), findsNothing);
    expect(find.byTooltip('Выгрузить Gruvbox'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
