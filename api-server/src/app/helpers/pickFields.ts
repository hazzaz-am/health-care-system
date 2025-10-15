/**
 * The `pickFields` function in TypeScript selects specific fields from req.query based on the provided
 * keys.
 * @param {T} obj - `obj` is an object of type `T` from which we want to pick specific fields.
 * @param {K[]} keys - The `keys` parameter in the `pickFields` function is an array of keys that
 * represent the fields you want to pick from the object `obj`.
 * @returns The `pickFields` function returns a new object that contains only the specified keys from
 * the original object `obj`. The returned object has the type `Pick<T, K>`, which represents a subset
 * of properties from the original object `T` based on the keys `K` provided.
 */
export const pickFields = <T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (Object.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  });
  return result;
};