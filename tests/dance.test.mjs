import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BPM, BIG_BEAT_SECONDS, beatPosition, parseBpm, danceProfile, performanceProfile, sampleDance } from '../src/beat.js';
import { createSilentClock, validateAudioFile } from '../src/audio.js';
import { seededRandom, interpret } from '../src/engine.js';
import { QUIPS, banterFor, bubbleLines } from '../src/banter.js';
import { parseByteRange } from '../src/media.js';

test('the shared media clock follows the selected BPM without accumulating drift', () => {
  assert.equal(BPM, 120);
  assert.equal(beatPosition(60), 120);
  assert.equal(beatPosition(BIG_BEAT_SECONDS), 2);
  const offset = .213;
  for (const bpm of [30, 65, 120, 130, 147.5, 300]) {
    assert.ok(Math.abs(beatPosition(60 + offset, offset, bpm) - bpm) < 1e-10);
    assert.ok(Math.abs(beatPosition(6000 + offset, offset, bpm) - bpm * 100) < 1e-8);
    assert.ok(Math.abs(beatPosition(120 / bpm + offset, offset, bpm) - 2) < 1e-10);
  }
});

test('invalid BPM and non-audio input are rejected before replacing working settings', () => {
  for (const value of ['', ' ', 'fast', null, undefined, 0, 29.9, 300.1, NaN, Infinity]) assert.throws(() => parseBpm(value), RangeError);
  assert.equal(parseBpm(' 130 '), 130);
  assert.equal(parseBpm(65.5), 65.5);
  assert.equal(validateAudioFile({ name: 'my song.M4A', size: 1200, type: '' }).size, 1200);
  assert.equal(validateAudioFile({ name: 'recording', size: 1200, type: 'audio/wav' }).type, 'audio/wav');
  for (const file of [null, { name: 'empty.mp3', size: 0 }, { name: 'script.html', size: 10, type: 'text/html' }]) assert.throws(() => validateAudioFile(file));
});

test('silent dancing pauses, resumes and resets on one monotonic clock', () => {
  let now = 1000;
  const clock = createSilentClock(() => now);
  assert.equal(clock.time(), 0);
  clock.start();
  now += 2500;
  assert.equal(clock.time(), 2.5);
  clock.start();
  assert.equal(clock.time(), 2.5, 'start is idempotent');
  clock.pause();
  now += 60000;
  assert.equal(clock.time(), 2.5);
  clock.start();
  now += 500;
  assert.equal(clock.time(), 3);
  clock.reset();
  assert.equal(clock.time(), 0);
  now += 1000;
  assert.equal(clock.time(), 1);
  clock.pause();
  clock.reset();
  now += 1000;
  assert.equal(clock.time(), 0);
});

test('every object lands on an integer beat; variation never changes its tempo', () => {
  const random = seededRandom(42);
  for (const light of [false, true]) for (const kind of ['panel', 'word', 'cow', 'particle']) {
    for (let i = 0; i < 20; i++) {
      const profile = danceProfile(kind, random, light);
      assert.ok([1, 2].includes(profile.cycleBeats));
      for (let cycle = 0; cycle < 10; cycle++) {
        const pose = sampleDance(cycle * profile.cycleBeats, profile);
        assert.deepEqual(pose, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
      }
      const jumping = sampleDance(profile.cycleBeats * .46, profile);
      assert.ok(jumping.y < 0);
      assert.ok(Math.abs(jumping.y + profile.height) < 1e-8);
      assert.ok(Math.abs(sampleDance((800 + .46) * profile.cycleBeats, profile).y + profile.height) < 1e-8);
    }
  }
});

test('word flight fits its padded scene; light mode bounds work independently of tree size', () => {
  const random = seededRandom(731);
  for (const light of [false, true]) for (let i = 0; i < 30; i++) {
    const profile = danceProfile('word', random, light);
    for (let step = 0; step <= 100; step++) {
      const pose = sampleDance(step / 100, profile);
      assert.ok(pose.y >= -70 && pose.y <= 5);
      assert.ok(Math.abs(pose.x) <= 8);
      assert.ok(Math.abs(pose.rotation) <= 8);
      assert.ok(pose.scaleY > .5 && pose.scaleX < 1.31);
    }
  }
  assert.deepEqual(performanceProfile(79), { light: false, fps: 60, maxTargets: 80 });
  for (const count of [80, 100, 1000]) assert.deepEqual(performanceProfile(count), { light: true, fps: 30, maxTargets: 32 });
});

test('banter has over 100 distinct lines, context-aware roles, and stable identities', () => {
  const all = Object.values(QUIPS).flat();
  assert.ok(new Set(all).size >= 100);
  const model = interpret(100, { seed: 42 });
  for (const group of model.groups) {
    const first = banterFor(group, model);
    assert.equal(first.nickname, banterFor(group, model, 12).nickname);
    assert.deepEqual(first, banterFor(group, model));
    assert.ok(all.includes(first.quote));
    if (group.incoming.length >= 2) assert.equal(first.category, 'crowd');
    else if (group.incoming.length && group.outgoing.length) assert.equal(first.category, 'sandwich');
    const choices = new Set(Array.from({ length: 40 }, (_, round) => banterFor(group, model, round).quote));
    assert.ok(choices.size > 10);
    assert.ok(bubbleLines(first.quote).every(line => Array.from(line).length <= 11));
  }
  assert.equal(banterFor(interpret(1).groups[0], model).category, 'implicit');
});

test('media ranges support seeking, suffix metadata, and correct unsatisfiable responses', () => {
  assert.equal(parseByteRange(undefined, 1000), null);
  assert.deepEqual(parseByteRange('bytes=0-31', 1000), { start: 0, end: 31, length: 32 });
  assert.deepEqual(parseByteRange('bytes=900-', 1000), { start: 900, end: 999, length: 100 });
  assert.deepEqual(parseByteRange('bytes=-128', 1000), { start: 872, end: 999, length: 128 });
  assert.deepEqual(parseByteRange('bytes=10-5000', 1000), { start: 10, end: 999, length: 990 });
  for (const header of ['bytes=-0', 'bytes=-', 'bytes=1000-', 'bytes=30-20', 'bytes=0-1,3-4', 'not a range']) assert.equal(parseByteRange(header, 1000), false);
});
