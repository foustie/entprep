import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import HomeSubjectGrid from '../HomeSubjectGrid';

const nav = vi.fn();
vi.mock('../../contexts/NavigationContext', () => ({ useNav: () => ({ nav }) }));
vi.mock('../../locales', () => ({
  useT: () => ({
    subjects: { math: 'Математика', reading: 'Чтение' },
    home: { mandatory: 'Обязательные', profile: 'Профильные' },
    rush: { questionsWord: 'вопрос|вопроса|вопросов' },
  }),
}));
vi.mock('../ui/SubjectIcon', () => ({ SubjectChip: () => null }));

const subj = (id: string, name: string) => ({ id, name, color: '#FF5A36', pool: 100, icon: '🔢' }) as never;

beforeEach(() => { cleanup(); nav.mockClear(); });

describe('HomeSubjectGrid onPick routing', () => {
  it('without onPick: tapping a subject navigates to its detail (question bank)', () => {
    render(<HomeSubjectGrid mandatory={[subj('math', 'Математика')]} profile={[]} hist={[]} poolSizes={{ math: 100 }} bests={{}} />);
    fireEvent.click(screen.getByText('Математика'));
    expect(nav).toHaveBeenCalledWith('topics', 'math');
  });

  it('reading (no sections) navigates straight to the test', () => {
    render(<HomeSubjectGrid mandatory={[subj('reading', 'Чтение')]} profile={[]} hist={[]} poolSizes={{ reading: 50 }} bests={{}} />);
    fireEvent.click(screen.getByText('Чтение'));
    expect(nav).toHaveBeenCalledWith('test', 'reading');
  });

  it('with onPick: tapping a subject calls onPick instead of navigating (Theory flow)', () => {
    const onPick = vi.fn();
    render(<HomeSubjectGrid mandatory={[subj('math', 'Математика')]} profile={[]} hist={[]} poolSizes={{ math: 100 }} bests={{}} onPick={onPick} />);
    fireEvent.click(screen.getByText('Математика'));
    expect(onPick).toHaveBeenCalledWith('math');
    expect(nav).not.toHaveBeenCalled();
  });
});
