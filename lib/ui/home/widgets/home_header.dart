import 'package:flutter/material.dart';

import '../home_state.dart';

class HomeHeader extends StatelessWidget {
  const HomeHeader({super.key, required this.state});
  final HomeState state;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 18),
    child: Row(
      children: [
        Image.asset(
          'design/assets/logo-${state.lightTheme ? 'ink' : 'cream'}.png',
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
            state.error ?? state.context?.siteLabel ?? 'Получаем вкладку…',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontFamily: 'JetBrainsMono',
              fontSize: 9,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
      ],
    ),
  );
}
