import 'package:flutter/material.dart';

import '../home_cubit.dart';
import '../home_state.dart';

class HomeFooter extends StatelessWidget {
  const HomeFooter({super.key, required this.state, required this.cubit});
  final HomeState state;
  final HomeCubit cubit;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return SizedBox(
      height: 32,
      child: Row(
        children: [
          Icon(
            Icons.circle,
            size: 5,
            color: Color(state.lightTheme ? 0xFF79740E : 0xFFB8BB26),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              state.scopeLabel,
              style: TextStyle(fontSize: 9, color: colors.onSurfaceVariant),
            ),
          ),
          IconButton(
            tooltip: state.lightTheme ? 'Тёмная тема' : 'Светлая тема',
            icon: Icon(
              state.lightTheme
                  ? Icons.dark_mode_outlined
                  : Icons.light_mode_outlined,
              size: 15,
            ),
            onPressed: state.busy ? null : cubit.toggleTheme,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints.tightFor(width: 30, height: 30),
          ),
          const SizedBox(width: 4),
          TextButton(
            onPressed: state.busy ? null : cubit.toggleLibrary,
            style: TextButton.styleFrom(
              minimumSize: const Size(40, 30),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              foregroundColor: state.showAll
                  ? colors.primary
                  : colors.onSurfaceVariant,
              backgroundColor: state.showAll
                  ? colors.primary.withValues(alpha: 0.08)
                  : null,
            ),
            child: const Text(
              'Все',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}
