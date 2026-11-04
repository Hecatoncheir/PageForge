import 'package:flutter/material.dart';

import '../home_cubit.dart';
import '../home_state.dart';
import 'appearance_card.dart';

class AppearancePanel extends StatelessWidget {
  const AppearancePanel({super.key, required this.cubit, required this.state});
  final HomeCubit cubit;
  final HomeState state;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final appearances = state.context?.appearances ?? [];
    return Column(
      children: [
        SizedBox(
          height: 34,
          child: TextButton(
            onPressed: state.canReset ? () => cubit.select(null) : null,
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
                  state.context?.selectedId == null
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                  size: 11,
                  color: state.context?.selectedId == null
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
                  itemBuilder: (context, index) => AppearanceCard(
                    appearance: appearances[index],
                    cubit: cubit,
                    state: state,
                  ),
                ),
        ),
      ],
    );
  }
}
