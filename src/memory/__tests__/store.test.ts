import { testContents } from "../../fixtures/contents";
import { hashContents } from "../store";


test('test hash', async () => {
    const result = hashContents(testContents());
    expect(result).toEqual('f29a8053c0d5c2365ecf2b398366c4208ab5e3d0daa6e17b25e2618b9f72ecbb');
});