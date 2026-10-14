import { sharedTypes, SpeakerDTO } from './shared-types';

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
});

