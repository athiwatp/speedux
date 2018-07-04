/**
 * Dependency imports.
 */
import {
  createStore,
  combineReducers,
  applyMiddleware,
  compose,
} from 'redux';

import createSagaMiddleware from 'redux-saga';

/**
 * Local imports.
 */
import * as helpers from './helpers';

/**
 * Reference to hold the Redux store instance.
 * @type {Object}
 */
let storeInstance;

/**
 * An array of getState calls that were executed during a state update.
 * Each callback function in this array will be invoked with the new
 * state once the state is updated and then the array will be emptied.
 * @type {Array}
 */
let getStateCallbacks = [];

/**
 * Creates the saga middleware function.
 * @type {Function}
 */
export const sagaMiddleware = createSagaMiddleware();

/**
 * Creates the saga store enhancer.
 * @type {Function}
 */
export const sagaEnhancer = applyMiddleware(sagaMiddleware);

/**
 * Creates a middleware function that is used to enable Redux devTools.
 * in the browser.
 * @type {Function}
 */
export const devTools = compose(window.devToolsExtension ? window.devToolsExtension() : foo => foo);

/**
 * This is not the actual store object. This is a wrapper object that manages
 * the Redux store instance. Use `StoreManager.getInstance()` to get a reference
 * to the Redux store.
 */
export const StoreManager = {
  /**
   * An object that is used as a map to store references to registered
   * reducers. This object is used by `getRootReducer` to create the
   * root reducer for the store.
   * @type {Object}
   */
  reducers: {},

  /**
   * An array of middlewares to use when creating the store.
   * Use `useMiddleware` method to add other middleware functions to this list.
   * @type {Array}
   */
  middleWares: [sagaEnhancer, devTools],

  /**
   * Registers a reducer function.
   * @param  {String}   key       Reducer unique identifier key.
   * @param  {Function} reducer   Reducer function.
   */
  addReducer(name, reducer) {
    StoreManager.reducers[name] = reducer;
    StoreManager.update();
  },

  /**
   * Unregisters a reducer function. If you remove a reducer, you have to explicitly
   * call StoreManager.update() afterwards.
   * @param  {String}   key       Reducer unique identifier key.
   */
  removeReducer(name) {
    delete StoreManager.reducers[name];
  },

  /**
   * Unregisters all reducer functions. If you remove all reducers, you have to explicitly
   * call StoreManager.update() afterwards.
   */
  removeAllReducers() {
    Object.keys(StoreManager.reducers).forEach(name => StoreManager.removeReducer(name));
  },

  /**
   * Combines all registered reducers and returns a single reducer function.
   * @return {Function} The root reducer function.
   */
  getRootReducer() {
    const reducers = { ...StoreManager.reducers };

    if (Object.keys(reducers).length === 0 || process.env.NODE_ENV === 'test') {
      reducers.$_foo = (state = {}) => state; // default reducer
    }

    const rootReducer = combineReducers(reducers);

    return (state, action) => {
      // start updating the state
      StoreManager.$updatingState = true;
      // clear getState calls queue
      getStateCallbacks = [];

      // get the new state object
      const newState = rootReducer(state, action);

      // invoke each getState call in the queue with the new state
      StoreManager.$updatingState = false;
      while (getStateCallbacks.length) getStateCallbacks.shift()(newState);

      // return the new state
      return newState;
    };
  },

  /**
   * Returns the complete state object or part of it based on a given query. If the
   * query parameter is a string that uses dot notation, it will return the resolved
   * value of the given key. If the query is an object, it will return an object that
   * has the same structure but contains the resolved values. If the query parameter
   * is not provided, the complete state object will be returned.
   * @param   {String|Object}   query   A query string or a query object that represents
   *                                    part of the state object that needs to be fetched.
   *                                    This parameter is not required.
   * @return  {Promise}                 A promise that eventually resolves with the state
   *                                    object, part of it or a value in the state object.
   */
  getState(query) {
    if (StoreManager.$updatingState === false) {
      return Promise.resolve(StoreManager.queryState(query, storeInstance.getState()));
    }

    return new Promise((resolve) => {
      getStateCallbacks.push((state) => {
        resolve(StoreManager.queryState(query, state));
      });
    });
  },

  /**
   * Queries a state object for a specific value.
   * @param   {String}    query   Query string.
   * @param   {Object}    state   State object to query.
   * @return  {Object}            The state object, part of it or a value in the state object.
   */
  queryState(query, state) {
    // handle query strings
    if (helpers.getObjectType(query) === 'string') {
      return helpers.findPropInObject(state, query);
    }

    // handle query objects
    if (helpers.getObjectType(query) === 'object') {
      return Object.keys(query).reduce((prev, next) => ({
        ...prev,
        [next]: helpers.findPropInObject(state, query[next]),
      }), {});
    }

    return state;
  },

  /**
   * Returns an reference to the Redux store instance.
   * @return {Object} Reference to the store instance.
   */
  getInstance() {
    if (!storeInstance) {
      StoreManager.buildInstance();
    }

    return storeInstance;
  },

  /**
   * Creates a new Redux store instance and updates the reference.
   */
  buildInstance() {
    storeInstance = createStore(
      StoreManager.getRootReducer(),
      compose(...StoreManager.middleWares),
    );
  },

  /**
   * Updates the root reducer of the store. Call this method after adding or
   * removing reducers.
   */
  update() {
    return storeInstance.replaceReducer(StoreManager.getRootReducer());
  },

  /**
   * Allows registering middleware functions such as Router and other middlewares.
   * @param {Function} middleWare Middleware function to use
   */
  useMiddleware(middleWare) {
    return StoreManager.middleWares.unshift(applyMiddleware(middleWare));
  },

  /**
   * Runs a saga generator function.
   * @param {Generator} saga      Saga to run.
   */
  runSaga(saga) {
    sagaMiddleware.run(saga);
  },
};

/**
 * Default export.
 */
export default StoreManager.getInstance();
