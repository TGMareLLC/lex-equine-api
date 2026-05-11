import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 25 },
    { duration: '10s', target: 250 },
    { duration: '20s', target: 250 },
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  const res = http.get('https://lex-equine-api.onrender.com/health');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}