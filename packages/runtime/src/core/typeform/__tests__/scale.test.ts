import {
  ratingSelectByDigit,
  linearSelectByDigit,
} from "../../typeform/scale/ScaleController";

describe("ScaleController", () => {
  test("ratingSelectByDigit respects bounds", () => {
    expect(ratingSelectByDigit(3, 1, 5)).toEqual({
      nextValue: 3,
      autoAdvance: true,
    });
    expect(ratingSelectByDigit(6, 1, 5)).toEqual({
      nextValue: null,
      autoAdvance: false,
    });
  });

  test("linearSelectByDigit respects range and step alignment", () => {
    expect(linearSelectByDigit(4, 2, 8, 2)).toEqual({
      nextValue: 4,
      autoAdvance: true,
    });
    expect(linearSelectByDigit(5, 2, 8, 2)).toEqual({
      nextValue: null,
      autoAdvance: false,
    });
  });
});
