import type { Credit } from "./types";

/**
 * Openly licensed gym photos from Wikimedia Commons. They have no stored
 * holds or beta: the app traces them in the browser when opened and
 * generates a start, finish and beta per colour (see autoBeta), the same way
 * it handles an uploaded photo.
 */
export interface SamplePhoto {
  id: string;
  name: string;
  imageUrl: string;
  credit: Credit;
}

export const samplePhotos: SamplePhoto[] = [
  {
    id: "blue-wall",
    name: "Blue wall",
    imageUrl: "/walls/samples/blue-wall.jpg",
    credit: {
      author: "Joe Mabel",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Bouldering_Project_(old_University_National_Bank)_06_-_ground_floor_climbing_walls.jpg",
    },
  },
  {
    id: "gray-gym",
    name: "Gray gym",
    imageUrl: "/walls/samples/gray-gym.jpg",
    credit: {
      author: "Ka23 13",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Climbing_wall_20211103_145408.jpg",
    },
  },
  {
    id: "gray-wall",
    name: "Gray wall",
    imageUrl: "/walls/samples/gray-wall.jpg",
    credit: {
      author: "Bondarev.gal",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Bouldering_wall_(Luch_Climbing_Gym)_in_Saint-Petersburg,_Russia.jpg",
    },
  },
  {
    id: "teal-wall",
    name: "Teal wall",
    imageUrl: "/walls/samples/teal-wall.jpg",
    credit: {
      author: "John Kane",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Man_climbing_in_bouldering_gym.jpg",
    },
  },
];
