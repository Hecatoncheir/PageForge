import 'package:flutter/material.dart';

import '../home_cubit.dart';
import '../home_state.dart';
import 'app_release_status.dart';
import 'library_card.dart';

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
                  itemBuilder: (context, index) => LibraryCard(
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
