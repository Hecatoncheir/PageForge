import 'package:flutter/material.dart';

class CardAction extends StatelessWidget {
  const CardAction({
    super.key,
    required this.label,
    required this.icon,
    this.onPressed,
  });
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
