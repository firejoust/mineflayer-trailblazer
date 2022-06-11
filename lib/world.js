const { readUInt4LE, writeUInt4LE } = require("./utils/uint4");

const Versions = require("minecraft-data").versionsByMinecraftVersion['pc'];
const BitArray = require("prismarine-chunk/src/pc/common/BitArray");
const Constants = require("prismarine-chunk/src/pc/common/constants");

// bit capacity may change in later versions
const StateArray = Uint16Array;

/*
**  container parsing
*/

// legacy chunk container
function getLegacyBitmap(buffer) {
    const bl = buffer.length;
    const nl = (bl / Constants.BLOCK_SECTION_VOLUME) * 8; // either 20 or 24 bits, depending on if skylight has been sent
    const dl = bl - (
        bl === (Constants.BLOCK_SECTION_VOLUME * 3) // 8*2 bits per 4096 blocks, strip the excess
        ? Constants.BLOCK_SECTION_VOLUME // skylight data included (24 bits - 8 bits)
        : Constants.BLOCK_SECTION_VOLUME / 2 // only light data (20 bits - 4 bits)
    );
    
    const data = Buffer.alloc(dl); // dl is how many blocks per byte

    /*
    **  the following aims to:
    **  - Convert a buffer of 20-24-bit blocks into a 16-bit block buffer (strip light data)
    **  - Split bytes into nibbles and iterate differently-sized buffers simultaneously
    */

    let b = 0; // current byte index in old buffer
    let d = 0; // current byte index in new buffer
    let n = 0; // checked bits of the current block (0-16 needed, 16-(20|24) skipped, resets at max bits)
    
    let bm = 0; // allowed nibbles per old buffer byte (4+4)
    let dm = 0; // allowed nibbles per new buffer byte (4+4)

    while (d < dl) {
        while (n < nl) {
            // anything above is not needed (light data)
            n += 4;
            if (n > Constants.GLOBAL_BITS_PER_BLOCK) continue;
            
            // current buf ref, with nibble float offset (+0 or +0.5)
            const ref = readUInt4LE(buffer, b + (bm / 8));

            // write 4 relevant palette bits to the new buffer
            writeUInt4LE(data, ref, d + (dm / 8));

            // reference the next 4 bits (for old buffer index & current block bit total)
            bm += 4;
            dm += 4;

            // increment old/new buffer index at byte maximum (8 bits)
            if (dm >= 8) { d++; dm = 0; }
            if (bm >= 8) { b++; bm = 0; }
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
    const data = new Uint8Array(4)
    data[0] = container.value
    // construct a BitArray with the global palette value
    return new BitArray({
        bitsPerValue: container.bitsPerValue,
        capacity: 1,
        data
    });
}

// creates a single valued bitmap filled with air
function getEmptyBitmap() {
    const data = new Uint8Array(4)
    return new BitArray({
        bitsPerValue: Constants.GLOBAL_BITS_PER_BLOCK,
        capacity: 1,
        data
    })
}

// converts a chunk section to bitmap
function getBitmap(section, version) {
    let data;

    // (>= 1.18) null container no longer available
    if (Versions[version].version > Versions["1.17.1"].version) {
        data = "value" in section.data
        ? getMonoBitmap(section.data)
        : section.data.data
    }

    // (< 1.18) "data" property is one level higher
    else if (Versions[version].version > Versions["1.15.2"].version) {
        // empty container
        data = section === null
        ? getEmptyBitmap()

        // single value container
        : "value" in section.data
        ? getMonoBitmap(section.data)

        // direct/indirect palette container
        : section.data
    }

    // (< 1.16) all containers use non-compact format
    else if (Versions[version].version > Versions["1.8.9"].version) {
        // empty container
        data = section === null
        ? getEmptyBitmap()

        // direct palette container
        : section.data
    }

    // (< 1.9) legacy buffer format
    // this will be slow as shit
    else {
        // 8-bit buffer
        data = getLegacyBitmap(section.data)
    }

    return data
}

/*
**  structures
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
**  buffer creation
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
                const data = getBitmap(section, client.version)

                sb[s] = new Section(
                    new BitMap(
                        data.data,
                        data.capacity,
                        data.bitsPerValue,
                        // spanned container format (1.15.2 and below)
                        Versions[client.version].version <= Versions["1.15.2"].version
                    ),
                    new StateArray(section?.palette || [])
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
                const data = getBitmap(section, client.version)

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