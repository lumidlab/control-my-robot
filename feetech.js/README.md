# feetech.js

This code was taken from this [bambot repo](https://github.com/dora-bambot/dora-bambot.github.io/tree/main/feetech.js)

## Usage

```bash
# Install the package
npm install feetech.js
```

```javascript
import { scsServoSDK } from 'feetech.js';

await scsServoSDK.connect();

const position = await scsServoSDK.readPosition(1);
console.log(position); // 1122
```


