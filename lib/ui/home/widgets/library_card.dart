import 'package:flutter/material.dart';

import '../../../domain/models/appearance.dart';
import '../home_cubit.dart';
import '../home_state.dart';
import 'appearance_preview.dart';
import 'card_action.dart';

class LibraryCard extends StatelessWidget {
  const LibraryCard({
    super.key,
    required this.appearance,
    required this.cubit,
    required this.state,
  });
  final Appearance appearance;
  final HomeCubit cubit;
  final HomeState state;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Material(
      color: colors.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: appearance.selected ? colors.primary : colors.outline,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [_tile(context), if (appearance.canUpdate) _updateButton()],
      ),
    );
  }

  Widget _tile(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final compatible =
        appearance.compatible && state.context?.supported == true;
    return ListTile(
      selected: appearance.selected,
      horizontalTitleGap: 10,
      leading: _preview(context),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      onTap: state.canApply(appearance)
          ? () => cubit.select(appearance.id)
          : null,
      title: Text(
        appearance.name,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: compatible ? colors.onSurface : colors.onSurfaceVariant,
        ),
      ),
      subtitle: Text(
        [
          appearance.siteLabel,
          appearance.selected ? 'Выбрано' : 'Не выбрано',
          if (appearance.update != null) appearance.update!.label,
        ].join('\n'),
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontFamily: 'JetBrainsMono',
          fontSize: 9,
          color: colors.onSurfaceVariant,
        ),
      ),
      trailing: _actions(),
    );
  }

  Widget _preview(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      width: 94,
      height: 56,
      child: Stack(
        children: [
          AppearancePreview(appearance: appearance, height: 56),
          if (appearance.selected)
            Positioned(
              top: 3,
              right: 3,
              child: Icon(
                Icons.check_circle,
                size: 18,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
        ],
      ),
    ),
  );

  Widget _actions() => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      if (appearance.update?.available == true &&
          appearance.update?.url != null)
        CardAction(
          label: 'Открыть релиз ${appearance.name}',
          icon: Icons.new_releases_outlined,
          onPressed: state.busy
              ? null
              : () => cubit.openRelease(appearance.update!.url!),
        ),
      CardAction(
        label: 'Выгрузить ${appearance.name}',
        icon: Icons.file_download_outlined,
        onPressed: state.busy ? null : () => cubit.exportArchive(appearance.id),
      ),
      CardAction(
        label: 'Удалить ${appearance.name}',
        icon: Icons.delete_outline,
        onPressed: state.busy ? null : () => cubit.remove(appearance.id),
      ),
    ],
  );

  Widget _updateButton() {
    final onPressed = state.canManage
        ? () => cubit.updateAppearance(appearance.id)
        : null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Tooltip(
          message: 'Обновить ${appearance.name}',
          excludeFromSemantics: true,
          child: Semantics(
            identifier: 'pageforge-update-${appearance.id}',
            label: 'Обновить ${appearance.name}',
            button: true,
            enabled: state.canManage,
            onTap: onPressed,
            child: ExcludeSemantics(
              child: TextButton.icon(
                onPressed: onPressed,
                icon: const Icon(Icons.download_outlined, size: 16),
                label: const Text('Обновить'),
                style: TextButton.styleFrom(
                  minimumSize: const Size(0, 30),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  textStyle: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
