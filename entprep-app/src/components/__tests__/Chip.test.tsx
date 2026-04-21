import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Chip from '../ui/Chip';

describe('Chip', () => {
  it('renders children', () => {
    render(<Chip active={false} onClick={() => {}}>Math</Chip>);
    expect(screen.getByText('Math')).toBeInTheDocument();
  });

  it('renders as button', () => {
    render(<Chip active={false} onClick={() => {}}>X</Chip>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    render(<Chip active={false} onClick={onClick}>Click</Chip>);
    fireEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('active chip has white text on ink background', () => {
    const { container } = render(<Chip active={true} onClick={() => {}}>Active</Chip>);
    const btn = container.querySelector('button')!;
    expect(btn.style.color).toBe('rgb(255, 255, 255)');
    expect(btn.style.background).toBe('rgb(15, 15, 16)');
  });

  it('inactive chip uses card background', () => {
    const { container } = render(<Chip active={false} onClick={() => {}}>Inactive</Chip>);
    const btn = container.querySelector('button')!;
    expect(btn.style.background).toContain('--bg-card');
  });

  it('both modes render consistent v2 ink pill (legacy prop ignored)', () => {
    const { container } = render(<Chip active={true} onClick={() => {}} mode="gradient">G</Chip>);
    const btn = container.querySelector('button')!;
    expect(btn.style.color).toBe('rgb(255, 255, 255)');
  });

  it('applies custom style', () => {
    const { container } = render(<Chip active={false} onClick={() => {}} style={{ marginLeft: 5 }}>X</Chip>);
    const btn = container.querySelector('button')!;
    expect(btn.style.marginLeft).toBe('5px');
  });
});
