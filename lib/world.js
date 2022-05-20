const { readUInt4LE, writeUInt4LE } = require("uint4");

const Versions = require("minecraft-data").versionsByMinecraftVersion['pc'];
const BitArray = require("prismarine-chunk/src/pc/common/BitArray");
const Constants = require("prismarine-chunk/src/pc/common/constants");

// bit capacity may change in later versions
const StateArray = Uint16Array;

/*
**  Bitmap Conversions
*/

// legacy chunk implementations (1.12.2 and below)
function getLegacyBitmap(buffer) {
    const bl = buffer.length;
    const dl = bl - (bl === (Constants.BLOCK_SECTION_VOLUME * 3) ? Constants.BLOCK_SECTION_VOLUME : Constants.BLOCK_SECTION_VOLUME / 2);
    const nl = (bl / Constants.BLOCK_SECTION_VOLUME) * 8; // either 20 or 24 bits, depending on if skylight has been sent
    
    const data = Buffer.alloc(dl); // dl is how many blocks per byte

    /*
    **  The following sequence has a lot of moving parts. It aims to:
    **  - Convert a buffer of 20-24-bit blocks into a 16-bit block buffer (strip light data)
    **  - Split bytes into nibbles (4-bit) to simultaneously iterate differently-sized buffers
    */

    let b = 0; // current byte index in old buffer
    let d = 0; // current byte index in new buffer
    let n = 0; // checked bits of the current block (0-16 needed, 16-(20|24) skipped, resets at max bits)
    
    let bm = 0; // allowed nibbles per old buffer byte (4+4)
    let dm = 0; // allowed nibbles per new buffer byte (4+4)

    while (d < dl) {
        while (n < nl) {
            const ref = readUInt4LE(buffer, b + (bm / 8)); // current buf ref, with nibble float offset (+0 or +0.5)

            // increment old/new buffer index at byte maximum (8 bits)
            if (dm >= 8) { d++; dm = 0; }
            if (bm >= 8) { b++; bm = 0; }

            // reference the next 4 bits (for old buffer index & current block bit total)
            bm += 4;
            n += 4;

            if (n > Constants.GLOBAL_BITS_PER_BLOCK) continue; // anything above is not needed (light data)

            // write 4 relevant palette bits to the new buffer
            writeUInt4LE(data, ref, d + (dm / 8));
            dm += 4;
        }
        n = 0;
    }

    // construct a BitArray instance from the new buffer
    return new BitArray({
        bitsPerValue: Constants.GLOBAL_BITS_PER_BLOCK,
        capacity: Constants.BLOCK_SECTION_VOLUME,
        data
    });
}

// creates a single valued bitmap
function getMonoBitmap(container) {
    const data = Buffer.alloc(4);
    data.writeUInt32LE(container.value, 0, Math.ceil(container.bitsPerValue / 8));
    // construct a BitArray with the global palette value
    return new BitArray({
        bitsPerValue: container.bitsPerValue,
        capacity: 1,
        data
    });
}

/*
**  Rust Structure Convertables
*/

function Column(x, z, sections) {
    this.x = x;
    this.z = z;
    this.sections = sections;
}

function Section(data, palette) {
    this.data = data;
    this.palette = palette;
}

function BitMap(data, capacity, bitsPerValue, spanned) {
    this.data = data;
    this.capacity = capacity;
    this.bitsPerValue = bitsPerValue;
    this.spanned = spanned;
}

/*
**  World Methods
*/

module.exports = class {
    static createBuffer(client) {
        const columns = client.world.getColumns();
        const cl = columns.length;
        const cb = new Array(cl);

        for (let c = 0; c < cl; c++) {
            const column = columns[c];
            const sl = column.column.sections.length;
            const sb = new Array(sl);

            for (let s = 0; s < sl; s++) {
                const section = column.column.sections[s];
                const data = section.data.value === undefined
                ? section.data.data // undefined if section.data is an ordinary buffer
                : getMonoBitmap(section.data) // single value container
                || getLegacyBitmap(section.data); // legacy container (fixed bits)
                
                sb[s] = new Section(
                    new BitMap(
                        data.data,
                        data.capacity,
                        data.bitsPerValue,
                        // spanned container format (1.15.2 and below)
                        Versions[client.version].version <= Versions["1.15.2"].version
                    ),
                    new StateArray(section.palette || [])
                )
            }

            cb[c] = new Column(
                parseInt(column.chunkX),
                parseInt(column.chunkZ),
                sb
            );
        }
        return cb;
    }

    static updateBuffer(client, buffer) {
        const columns = client.world.getColumns();
        const cl = buffer.length;

        for (let c = 0; c < cl; c++) {
            const column = columns[c];
            const column_old = buffer[c];
            const sl = column_old.sections.length;

            for (let s = 0; s < sl; s++) {
                const section = column.column.sections[s];
                const section_old = column_old.sections[s];
                const data = section.data.value === undefined
                ? section.data.data
                : getMonoBitmap(section.data)
                || getLegacyBitmap(section.data);

                section_old.data = new BitMap(
                    data.data,
                    data.capacity,
                    data.bitsPerValue,
                    Versions[client.version].version <= Versions["1.15.2"].version
                );
                section_old.palette = new StateArray(section.palette || []);
            }
        }
    }
}