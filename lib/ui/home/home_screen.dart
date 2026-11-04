import 'package:flutter/material.dart';

import '../../domain/models/appearance.dart';
import '../widgets/cupertino/sliding_segmented_control.dart';
import 'home_view_model.dart';

enum HomeTab { appearance, development }

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.model});

  final HomeViewModel model;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  HomeTab _tab = HomeTab.appearance;
  int _messageId = 0;
  HomeViewModel get model => widget.model;

  @override
  void initState() {
    super.initState();
    model.addListener(_onModelChanged);
  }

  @override
  void dispose() {
    model.removeListener(_onModelChanged);
    super.dispose();
  }

  void _selectTab(HomeTab tab) {
    setState(() => _tab = tab);
    model.developmentMode(tab == HomeTab.development);
  }

  void _onModelChanged() {
    if (_messageId == model.messageId) return;
    _messageId = model.messageId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || model.message == null) return;
      if (model.message == 'Оформление добавлено') {
        _selectTab(HomeTab.appearance);
      }
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(model.message!),
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final state = model.context;
    final reduced = MediaQuery.disableAnimationsOf(context);
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _ModeSelector(value: _tab, onChanged: _selectTab),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 18),
              child: Row(
                children: [
                  Image.asset(
                    'design/assets/logo-${model.lightTheme ? 'ink' : 'cream'}.png',
                    width: 24,
                    height: 28,
                    excludeFromSemantics: true,
                  ),
                  const SizedBox(width: 7),
                  const Text(
                    'PageForge',
                    style: TextStyle(
                      fontFamily: 'Nunito',
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.7,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      model.error ?? state?.siteLabel ?? 'Получаем вкладку…',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        fontFamily: 'JetBrainsMono',
                        fontSize: 9,
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 2,
              child: model.busy
                  ? const LinearProgressIndicator(minHeight: 2)
                  : null,
            ),
            const SizedBox(height: 6),
            Expanded(
              child: AnimatedSwitcher(
                duration: reduced
                    ? Duration.zero
                    : const Duration(milliseconds: 220),
                switchInCurve: Curves.easeOutCubic,
                child: _tab == HomeTab.appearance
                    ? _AppearancePanel(
                        key: const ValueKey(HomeTab.appearance),
                        model: model,
                      )
                    : _DevelopmentPanel(
                        key: const ValueKey(HomeTab.development),
                        model: model,
                      ),
              ),
            ),
            const SizedBox(height: 12),
            Divider(height: 1, color: colors.outline),
            const SizedBox(height: 12),
            SizedBox(
              height: 32,
              child: Row(
                children: [
                  Icon(
                    Icons.circle,
                    size: 5,
                    color: Color(model.lightTheme ? 0xFF79740E : 0xFFB8BB26),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      state?.supported == true
                          ? 'Только для этого сайта'
                          : 'Откройте сайт в браузере',
                      style: TextStyle(
                        fontSize: 9,
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: model.lightTheme ? 'Тёмная тема' : 'Светлая тема',
                    icon: Icon(
                      model.lightTheme
                          ? Icons.dark_mode_outlined
                          : Icons.light_mode_outlined,
                      size: 15,
                    ),
                    onPressed: model.busy ? null : model.toggleTheme,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints.tightFor(
                      width: 30,
                      height: 30,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'ZIP ↔',
                    style: TextStyle(
                      fontFamily: 'JetBrainsMono',
                      fontSize: 8,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ModeSelector extends StatelessWidget {
  const _ModeSelector({required this.value, required this.onChanged});

  final HomeTab value;
  final ValueChanged<HomeTab> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    const labels = {
      HomeTab.appearance: 'Отображение',
      HomeTab.development: 'Разработка',
    };
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.surfaceContainerLow,
        shape: RoundedSuperellipseBorder(
          side: BorderSide(color: colors.outline),
          borderRadius: BorderRadius.circular(14),
        ),
      ),
      child: PageForgeSlidingSegmentedControl<HomeTab>(
        groupValue: value,
        backgroundColor: Colors.transparent,
        thumbColor: colors.surfaceContainerHighest,
        showThumbShadow: Theme.of(context).brightness == Brightness.dark,
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
        onValueChanged: (selected) {
          if (selected != null) onChanged(selected);
        },
        children: {
          for (final entry in labels.entries)
            entry.key: SizedBox(
              height: 34,
              child: Center(
                child: Text(
                  entry.value,
                  style: TextStyle(
                    fontFamily: 'NunitoSans',
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: value == entry.key
                        ? colors.onSurface
                        : colors.onSurfaceVariant,
                  ),
                ),
              ),
            ),
        },
      ),
    );
  }
}

class _AppearancePanel extends StatelessWidget {
  const _AppearancePanel({super.key, required this.model});
  final HomeViewModel model;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final appearances = model.context?.appearances ?? [];
    return Column(
      children: [
        SizedBox(
          height: 34,
          child: TextButton(
            onPressed: !model.busy && model.context?.selectedId != null
                ? () => model.select(null)
                : null,
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              foregroundColor: colors.onSurfaceVariant,
            ),
            child: Row(
              children: [
                const Icon(Icons.restart_alt, size: 15),
                const SizedBox(width: 7),
                const Text(
                  'Исходное отображение',
                  style: TextStyle(fontSize: 11),
                ),
                const Spacer(),
                Icon(
                  model.context?.selectedId == null
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                  size: 11,
                  color: model.context?.selectedId == null
                      ? colors.primary
                      : colors.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: appearances.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.layers_outlined,
                        size: 34,
                        color: colors.onSurfaceVariant,
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'Пока нет оформлений',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Добавьте ZIP во вкладке «Разработка»',
                        style: TextStyle(
                          fontSize: 11,
                          color: colors.onSurfaceVariant,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              : GridView.builder(
                  key: const PageStorageKey('appearances'),
                  padding: const EdgeInsets.fromLTRB(1, 2, 1, 6),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    mainAxisExtent: 180,
                  ),
                  itemCount: appearances.length,
                  itemBuilder: (context, index) => _AppearanceCard(
                    appearance: appearances[index],
                    model: model,
                  ),
                ),
        ),
      ],
    );
  }
}

class _AppearanceCard extends StatelessWidget {
  const _AppearanceCard({required this.appearance, required this.model});
  final Appearance appearance;
  final HomeViewModel model;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final selected = model.context?.selectedId == appearance.id;
    return AnimatedContainer(
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        color: colors.surfaceContainerLow,
        border: Border.all(
          color: selected ? colors.primary : colors.outline,
          width: selected ? 1.6 : 1,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.all(7),
      child: Column(
        children: [
          Semantics(
            button: true,
            container: true,
            focusable: true,
            selected: selected,
            label: 'Применить ${appearance.name}',
            onTap: model.busy ? null : () => model.select(appearance.id),
            child: ExcludeSemantics(
              child: InkWell(
                onTap: model.busy ? null : () => model.select(appearance.id),
                borderRadius: BorderRadius.circular(8),
                child: Column(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: SizedBox(
                        height: 92,
                        width: double.infinity,
                        child: appearance.preview == null
                            ? ColoredBox(
                                color: colors.surfaceContainerHighest,
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.web_outlined,
                                      size: 27,
                                      color: colors.onSurfaceVariant,
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      appearance.previewState == 'capturing'
                                          ? 'Готовим превью…'
                                          : 'Превью при открытии сайта',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 8,
                                        color: colors.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            : Image.memory(
                                appearance.preview!,
                                fit: BoxFit.cover,
                                alignment: Alignment.topCenter,
                                gaplessPlayback: true,
                              ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            appearance.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        if (selected)
                          Icon(
                            Icons.check_circle,
                            size: 15,
                            color: colors.primary,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: Text(
                  appearance.version,
                  style: TextStyle(
                    fontFamily: 'JetBrainsMono',
                    fontSize: 8,
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ),
              _CardAction(
                label: 'Выгрузить ${appearance.name}',
                icon: Icons.file_download_outlined,
                onPressed: model.busy
                    ? null
                    : () => model.exportArchive(appearance.id),
              ),
              _CardAction(
                label: 'Удалить ${appearance.name}',
                icon: Icons.delete_outline,
                onPressed: model.busy
                    ? null
                    : () => model.remove(appearance.id),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CardAction extends StatelessWidget {
  const _CardAction({required this.label, required this.icon, this.onPressed});
  final String label;
  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: label,
    onPressed: onPressed,
    icon: Icon(icon, size: 14),
    padding: EdgeInsets.zero,
    visualDensity: VisualDensity.compact,
    constraints: const BoxConstraints.tightFor(width: 26, height: 26),
  );
}

class _DevelopmentPanel extends StatelessWidget {
  const _DevelopmentPanel({super.key, required this.model});
  final HomeViewModel model;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              button: true,
              enabled: model.context?.isExtension == true && !model.busy,
              label: 'Добавить ZIP',
              onTap: model.context?.isExtension == true && !model.busy
                  ? model.importArchive
                  : null,
              child: ExcludeSemantics(
                child: InkWell(
                  onTap: model.context?.isExtension == true && !model.busy
                      ? model.importArchive
                      : null,
                  borderRadius: BorderRadius.circular(18),
                  child: AnimatedContainer(
                    duration: MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : const Duration(milliseconds: 180),
                    height: (constraints.maxHeight - 132).clamp(200, 400),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: model.dragging ? colors.primary : colors.outline,
                      ),
                      borderRadius: BorderRadius.circular(18),
                      color: model.dragging
                          ? colors.primary.withValues(alpha: 0.08)
                          : null,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(15),
                          decoration: BoxDecoration(
                            color: colors.primary.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(17),
                          ),
                          child: Icon(
                            Icons.file_upload_outlined,
                            color: colors.primary,
                            size: 27,
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Добавить',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Перетащите ZIP или выберите файл',
                          style: TextStyle(
                            fontSize: 10,
                            color: colors.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 17),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            border: Border.all(color: colors.outline),
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: Text(
                            '.ZIP',
                            style: TextStyle(
                              fontFamily: 'JetBrainsMono',
                              fontSize: 8,
                              color: colors.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Semantics(
              button: true,
              label: 'Выгрузить ZIP',
              enabled: model.context?.supported == true && !model.busy,
              onTap: model.context?.supported == true && !model.busy
                  ? model.exportArchive
                  : null,
              child: ExcludeSemantics(
                child: InkWell(
                  onTap: model.context?.supported == true && !model.busy
                      ? model.exportArchive
                      : null,
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    height: 118,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: colors.surfaceContainerHighest,
                      border: Border.all(color: colors.outline),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.inventory_2_outlined,
                          size: 29,
                          color: colors.primary,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Выгрузить',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                model.selectedName,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: colors.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          Icons.arrow_forward,
                          size: 20,
                          color: colors.onSurfaceVariant,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
