import 'package:flutter/material.dart';

import '../home_cubit.dart';
import '../home_state.dart';

class DevelopmentPanel extends StatefulWidget {
  const DevelopmentPanel({super.key, required this.cubit, required this.state});
  final HomeCubit cubit;
  final HomeState state;

  @override
  State<DevelopmentPanel> createState() => _DevelopmentPanelState();
}

class _DevelopmentPanelState extends State<DevelopmentPanel> {
  final _repositoryUrl = TextEditingController();
  HomeCubit get cubit => widget.cubit;
  HomeState get state => widget.state;
  bool get _canImport =>
      state.context?.isExtension == true &&
      !state.busy &&
      _repositoryUrl.text.trim().isNotEmpty;

  void _importRepository() {
    if (_canImport) cubit.importRepository(_repositoryUrl.text);
  }

  @override
  void dispose() {
    _repositoryUrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              identifier: 'pageforge-import',
              button: true,
              enabled: state.canManage,
              label: 'Добавить ZIP',
              onTap: state.canManage ? cubit.importArchive : null,
              child: ExcludeSemantics(
                child: InkWell(
                  onTap: state.canManage ? cubit.importArchive : null,
                  borderRadius: BorderRadius.circular(18),
                  child: AnimatedContainer(
                    duration: MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : const Duration(milliseconds: 180),
                    height: (constraints.maxHeight - 194).clamp(160, 350),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: state.dragging ? colors.primary : colors.outline,
                      ),
                      borderRadius: BorderRadius.circular(18),
                      color: state.dragging
                          ? colors.primary.withValues(alpha: 0.08)
                          : null,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
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
                        const SizedBox(height: 12),
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
                        const SizedBox(height: 12),
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
            SizedBox(
              height: 48,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _repositoryUrl,
                      enabled: state.canManage,
                      onChanged: (_) => setState(() {}),
                      onSubmitted: (_) => _importRepository(),
                      keyboardType: TextInputType.url,
                      textInputAction: TextInputAction.go,
                      autocorrect: false,
                      style: const TextStyle(fontSize: 11),
                      decoration: InputDecoration(
                        labelText: 'Репозиторий GitHub',
                        hintText: 'https://github.com/owner/repo',
                        labelStyle: const TextStyle(fontSize: 11),
                        hintStyle: const TextStyle(fontSize: 10),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton(
                    tooltip: 'Добавить из репозитория',
                    onPressed: _canImport ? _importRepository : null,
                    color: colors.primary,
                    icon: const Icon(Icons.download_outlined, size: 22),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Semantics(
              button: true,
              label: 'Выгрузить ZIP',
              enabled: state.canExport,
              onTap: state.canExport ? cubit.exportArchive : null,
              child: ExcludeSemantics(
                child: InkWell(
                  onTap: state.canExport ? cubit.exportArchive : null,
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
                                state.selectedName,
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
