import 'package:flutter/material.dart';

import '../home_cubit.dart';
import '../home_state.dart';
import 'app_release_status.dart';
import 'appearance_preview.dart';
import 'card_action.dart';

class LibraryPanel extends StatelessWidget {
  const LibraryPanel({
    super.key,
    required this.cubit,
    required this.state,
    required this.onBack,
  });

  final HomeCubit cubit;
  final HomeState state;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final appearances = state.context?.allAppearances ?? [];
    return Column(
      children: [
        Row(
          children: [
            IconButton(
              onPressed: onBack,
              tooltip: 'К текущему сайту',
              icon: const Icon(Icons.arrow_back, size: 18),
            ),
            const Expanded(
              child: Text(
                'Все оформления',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
              ),
            ),
            Text(
              '${appearances.length}',
              style: TextStyle(
                fontFamily: 'JetBrainsMono',
                fontSize: 10,
                color: colors.onSurfaceVariant,
              ),
            ),
            IconButton(
              tooltip: 'Проверить обновления',
              onPressed: state.canManage ? cubit.checkUpdates : null,
              icon: const Icon(Icons.refresh, size: 19),
            ),
          ],
        ),
        const SizedBox(height: 8),
        AppReleaseStatus(cubit: cubit, state: state),
        const SizedBox(height: 10),
        Expanded(
          child: appearances.isEmpty
              ? const Center(child: Text('Пока нет оформлений'))
              : ListView.separated(
                  key: const PageStorageKey('library'),
                  padding: const EdgeInsets.only(bottom: 6),
                  itemCount: appearances.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final appearance = appearances[index];
                    final compatible =
                        appearance.compatible &&
                        state.context?.supported == true;
                    final selected = appearance.selected;
                    return Material(
                      color: colors.surfaceContainerLow,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(
                          color: selected ? colors.primary : colors.outline,
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: ListTile(
                        selected: selected,
                        horizontalTitleGap: 10,
                        leading: ExcludeSemantics(
                          child: SizedBox(
                            width: 94,
                            height: 56,
                            child: Stack(
                              children: [
                                AppearancePreview(
                                  appearance: appearance,
                                  height: 56,
                                ),
                                if (selected)
                                  Positioned(
                                    top: 3,
                                    right: 3,
                                    child: Icon(
                                      Icons.check_circle,
                                      size: 18,
                                      color: colors.primary,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 7,
                        ),
                        onTap: compatible && !state.busy
                            ? () => cubit.select(appearance.id)
                            : null,
                        title: Text(
                          appearance.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: compatible
                                ? colors.onSurface
                                : colors.onSurfaceVariant,
                          ),
                        ),
                        subtitle: Text(
                          [
                            appearance.siteLabel,
                            selected ? 'Выбрано' : 'Не выбрано',
                            if (appearance.update != null)
                              appearance.update!.label,
                          ].join('\n'),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: 'JetBrainsMono',
                            fontSize: 9,
                            color: colors.onSurfaceVariant,
                          ),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (appearance.update?.available == true &&
                                appearance.update?.url != null)
                              CardAction(
                                label: 'Открыть релиз ${appearance.name}',
                                icon: Icons.new_releases_outlined,
                                onPressed: state.busy
                                    ? null
                                    : () => cubit.openRelease(
                                        appearance.update!.url!,
                                      ),
                              ),
                            CardAction(
                              label: 'Выгрузить ${appearance.name}',
                              icon: Icons.file_download_outlined,
                              onPressed: state.busy
                                  ? null
                                  : () => cubit.exportArchive(appearance.id),
                            ),
                            CardAction(
                              label: 'Удалить ${appearance.name}',
                              icon: Icons.delete_outline,
                              onPressed: state.busy
                                  ? null
                                  : () => cubit.remove(appearance.id),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
