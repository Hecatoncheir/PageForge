import 'package:flutter/material.dart';

import '../../data/repositories/browser_repository.dart';
import 'home_view_model.dart';

enum HomeTab { appearance, development }

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.repository});

  final BrowserRepository repository;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final HomeViewModel _model;
  HomeTab _tab = HomeTab.appearance;

  @override
  void initState() {
    super.initState();
    _model = HomeViewModel(widget.repository)..load();
  }

  @override
  void dispose() {
    _model.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SegmentedButton<HomeTab>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(
                  value: HomeTab.appearance,
                  label: Text('Отображение'),
                ),
                ButtonSegment(
                  value: HomeTab.development,
                  label: Text('Разработка'),
                ),
              ],
              selected: {_tab},
              onSelectionChanged: (selection) {
                setState(() => _tab = selection.single);
              },
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                const Icon(Icons.layers_outlined, size: 24),
                const SizedBox(width: 10),
                Text(
                  'PageForge',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const Spacer(),
                ListenableBuilder(
                  listenable: _model,
                  builder: (context, _) => Text(_model.context?.version ?? ''),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ListenableBuilder(
              listenable: _model,
              builder: (context, _) => Text(
                _model.error ??
                    _model.context?.siteLabel ??
                    'Получаем вкладку…',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: _tab == HomeTab.appearance
                  ? const _AppearancePanel()
                  : const _DevelopmentPanel(),
            ),
            const SizedBox(height: 12),
            Text(
              'Ранняя версия · применение оформлений ещё в разработке',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _AppearancePanel extends StatelessWidget {
  const _AppearancePanel();

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        Card.outlined(
          margin: EdgeInsets.zero,
          child: const ListTile(
            leading: Icon(Icons.web_outlined),
            title: Text('Исходное отображение'),
            subtitle: Text('Оформление самого сайта'),
            trailing: Icon(Icons.check_circle_outline),
          ),
        ),
        const SizedBox(height: 24),
        const Icon(Icons.palette_outlined, size: 38),
        const SizedBox(height: 12),
        const Text('Здесь появятся ваши варианты', textAlign: TextAlign.center),
        const SizedBox(height: 8),
        Text(
          'Импорт ZIP и автоматические превью будут добавлены позже.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _DevelopmentPanel extends StatelessWidget {
  const _DevelopmentPanel();

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: const [
        _DevelopmentArea(
          title: 'Добавить',
          description: 'Перетащить ZIP или выбрать файл',
          icon: Icons.add_box_outlined,
          filled: false,
        ),
        SizedBox(height: 16),
        _DevelopmentArea(
          title: 'Выгрузить',
          description: 'Скачать вариант или основу для текущего сайта',
          icon: Icons.file_download_outlined,
          filled: true,
        ),
      ],
    );
  }
}

class _DevelopmentArea extends StatelessWidget {
  const _DevelopmentArea({
    required this.title,
    required this.description,
    required this.icon,
    required this.filled,
  });

  final String title;
  final String description;
  final IconData icon;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      enabled: false,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: filled ? colors.surfaceContainerHighest : null,
          border: Border.all(color: colors.outlineVariant),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(icon, size: 28),
            const SizedBox(height: 8),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(description, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text('В разработке', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
