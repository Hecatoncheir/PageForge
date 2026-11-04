import 'package:flutter/material.dart';

import '../home_cubit.dart';
import '../home_state.dart';

class AppReleaseStatus extends StatelessWidget {
  const AppReleaseStatus({super.key, required this.cubit, required this.state});
  final HomeCubit cubit;
  final HomeState state;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final release = state.context?.appUpdate;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.outline),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'PageForge ${state.context?.version ?? ''}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Tooltip(
                  message:
                      release?.error ??
                      'Проверка релизов PageForge и оформлений',
                  child: Text(
                    release?.label ?? 'Обновления приложения и оформлений',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (release?.available == true && release?.url != null)
            IconButton(
              tooltip: 'Открыть релиз PageForge',
              onPressed: state.busy
                  ? null
                  : () => cubit.openRelease(release!.url!),
              icon: Icon(Icons.open_in_new, size: 19, color: colors.primary),
            ),
        ],
      ),
    );
  }
}
