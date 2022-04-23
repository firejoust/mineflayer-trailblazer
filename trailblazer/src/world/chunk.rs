use crate::block::Block;
struct ChunkSection {
    palette: Vec<u32>,
    data: [u32; 512],
    max_bits: u32,
    bits_per_value: u32,
    values_per_long: u32,
    value_mask: u32,
    capacity: u32,
}

struct ChunkColumn {
    chunk_x: i32,
    chunk_y: i32,
    sections: Vec<ChunkSection>
}

struct ChunkGrid {
    position: [i32; 3],
    blocks: [[[Block; 16]; 16]; 16]
}
