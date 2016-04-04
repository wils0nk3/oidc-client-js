import Log from './Log';
import Window from './Window';

export default class WebStorageStateStore {
    constructor({prefix = "oidc.", store = Window.localStorage} = {}) {
        this._store = store;
        this._prefix = prefix;
    }

    set(key, value) {
        Log.info("WebStorageStateStore.set", key);

        key = this._prefix + key;

        this._store.setItem(key, value);
        
        return Promise.resolve();
    }

    get(key) {
        Log.info("WebStorageStateStore.get", key);

        key = this._prefix + key;

        let item = this._store.getItem(key);
        
        return Promise.resolve(item);
    }

    remove(key) {
        Log.info("WebStorageStateStore.remove", key);

        key = this._prefix + key;

        let item = this._store.getItem(key);
        this._store.removeItem(key);
        
        return Promise.resolve(item);
    }

    getAllKeys() {
        var keys = [];

        for (let index = 0; index < this._store.length; index++) {
            let key = this._store.key(index);
            
            if (key.indexOf(this._prefix) === 0) {
                keys.push(key);
            }
        }
        
        return Promise.resolve(keys);
    }
}
