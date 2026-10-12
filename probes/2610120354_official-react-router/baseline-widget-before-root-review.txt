import { useState } from 'react';

export default function BaselineWidget() {
  const [count, setCount] = useState(0);
  const [controlled, setControlled] = useState('');
  const [uncontrolledEcho, setUncontrolledEcho] = useState('');

  return (
    <div data-probe="baseline-widget" className="not-prose flex flex-col gap-3 my-4 p-4 border rounded-md">
      <button
        type="button"
        data-probe-button="counter"
        className="self-start px-3 py-1 border rounded-md w-fit"
        onClick={() => setCount((c) => c + 1)}
      >
        Baseline count: {count}
      </button>
      <label className="flex flex-col gap-1 text-sm">
        Controlled input
        <input
          data-probe-input="controlled"
          className="border rounded-md px-2 py-1"
          value={controlled}
          onChange={(e) => setControlled(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Uncontrolled input (defaultValue seed)
        <input
          data-probe-input="uncontrolled"
          className="border rounded-md px-2 py-1"
          defaultValue="seed"
          onChange={(e) => setUncontrolledEcho(e.target.value)}
        />
      </label>
      <span data-probe="mirror" className="text-sm">
        mirror: {controlled} | {uncontrolledEcho || 'seed'}
      </span>
    </div>
  );
}
