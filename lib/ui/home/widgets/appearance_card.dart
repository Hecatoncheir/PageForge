import 'package:flutter/material.dart';

import '../../../domain/models/appearance.dart';
import '../home_cubit.dart';
import '../home_state.dart';
import 'appearance_preview.dart';
import 'card_action.dart';

class AppearanceCard extends StatelessWidget {
  const AppearanceCard({
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
    final selected = state.context?.selectedId == appearance.id;
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
            onTap: state.busy ? null : () => cubit.select(appearance.id),
            child: ExcludeSemantics(
              child: InkWell(
                onTap: state.busy ? null : () => cubit.select(appearance.id),
                borderRadius: BorderRadius.circular(8),
                child: Column(
                  children: [
                    AppearancePreview(appearance: appearance, height: 92),
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
        ],
      ),
    );
  }
}
