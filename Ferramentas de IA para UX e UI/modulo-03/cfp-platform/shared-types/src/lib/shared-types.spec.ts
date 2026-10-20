import { sharedTypes, SpeakerDTO, EventDTO } from './shared-types';

describe('sharedTypes', () => {
  it('should work', () => {
    expect(sharedTypes()).toEqual('shared-types');
  });

  it('should correctly type a SpeakerDTO object', () => {
    const speaker: SpeakerDTO = {
      id: '1',
      nome: 'Jane Doe',
      email: 'jane@example.com',
      talkTitle: 'Building Scalable Angular Apps',
      isGDE: true,
    };
    expect(speaker.id).toBe('1');
    expect(speaker.isGDE).toBe(true);
  });

  it('should correctly type an EventDTO object', () => {
    const event: EventDTO = {
      id: '101',
      nome: 'Tech Conference 2026',
      endereco: 'Av. Paulista, 1000 - São Paulo, SP',
      capacidade: 500,
      data: '2026-11-15',
    };
    expect(event.id).toBe('101');
    expect(event.capacidade).toBe(500);
  });
});
