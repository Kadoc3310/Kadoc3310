from PIL import Image, ImageDraw

def create_apple():
    """Creates a simple red apple sprite."""
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Body of the apple
    draw.ellipse((2, 4, 28, 30), fill='red', outline='darkred')
    # Stem
    draw.line((15, 5, 15, 0), fill='brown', width=2)
    img.save('assets/apple.png')

def create_pear():
    """Creates a simple green pear sprite."""
    img = Image.new('RGBA', (32, 48), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Body of the pear (a simple ellipse)
    draw.ellipse((4, 2, 28, 46), fill='yellowgreen', outline='darkgreen')
    # Stem
    draw.line((15, 5, 15, 0), fill='brown', width=2)
    img.save('assets/pear.png')

def create_seed():
    """Creates a small, brown seed sprite."""
    img = Image.new('RGBA', (8, 12), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((0, 0, 7, 11), fill='#5C4033', outline='black') # Dark brown
    img.save('assets/seed.png')

def create_peach():
    """Creates a simple pinkish-orange peach sprite."""
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((2, 2, 28, 28), fill='#FFDAB9', outline='#E9967A') # PeachPuff and DarkSalmon
    img.save('assets/peach.png')

def create_banana():
    """Creates a simple yellow banana sprite."""
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # A simple crescent shape for the banana
    draw.arc((2, 2, 30, 30), start=200, end=340, fill='yellow', width=6)
    img.save('assets/banana.png')

if __name__ == "__main__":
    create_apple()
    create_pear()
    create_seed()
    create_peach()
    create_banana()
    print("Sprites created successfully in the 'assets' directory.")