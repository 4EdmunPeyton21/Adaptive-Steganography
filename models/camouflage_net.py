import torch
import torch.nn as nn
import torch.nn.functional as F

class DoubleConv(nn.Module):
    """(Convolution => BatchNorm => ReLU) * 2"""
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.double_conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True)
        )

    def forward(self, x):
        return self.double_conv(x)

class Down(nn.Module):
    """Downscaling with MaxPool then DoubleConv"""
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.maxpool_conv = nn.Sequential(
            nn.MaxPool2d(2),
            DoubleConv(in_channels, out_channels)
        )

    def forward(self, x):
        return self.maxpool_conv(x)

class Up(nn.Module):
    """Upscaling then DoubleConv"""
    def __init__(self, in_channels, out_channels):
        super().__init__()
        # Bilinear upsampling 
        self.up = nn.Upsample(scale_factor=2, mode='bilinear', align_corners=True)
        self.conv = DoubleConv(in_channels + in_channels // 2, out_channels)

    def forward(self, x1, x2):
        x1 = self.up(x1)
        # Pad if dimensions don't match perfectly
        diffY = x2.size()[2] - x1.size()[2]
        diffX = x2.size()[3] - x1.size()[3]
        x1 = F.pad(x1, [diffX // 2, diffX - diffX // 2, diffY // 2, diffY - diffY // 2])
        
        # Skip Connection: Concatenate the encoder feature map with the decoder feature map
        x = torch.cat([x2, x1], dim=1)
        return self.conv(x)

class CamouflageNet(nn.Module):
    
    def __init__(self, n_channels=3, n_classes=1):
        super(CamouflageNet, self).__init__()
        self.n_channels = n_channels
        
        # Base channels = 32 (keeps the model lightweight so it doesn't crash your GPU later)
        # 1. The Encoder (Understanding the image)
        self.inc = DoubleConv(n_channels, 32)
        self.down1 = Down(32, 64)
        self.down2 = Down(64, 128)
        self.down3 = Down(128, 256)
        
        # 2. The Bottleneck
        self.down4 = Down(256, 512)

        # 3. The Decoder (Drawing the map)
        self.up1 = Up(512, 256)
        self.up2 = Up(256, 128)
        self.up3 = Up(128, 64)
        self.up4 = Up(64, 32)
        
        # 4. The Final Output Layer (condensing to 1 channel)
        self.outc = nn.Conv2d(32, n_classes, kernel_size=1)

    def forward(self, x):
        # Downward path
        x1 = self.inc(x)
        x2 = self.down1(x1)
        x3 = self.down2(x2)
        x4 = self.down3(x3)
        x5 = self.down4(x4)
        
        # Upward path 
        x = self.up1(x5, x4)
        x = self.up2(x, x3)
        x = self.up3(x, x2)
        x = self.up4(x, x1)
        
        logits = self.outc(x)
        
        # Sigmoid activation 
        capacity_map = torch.sigmoid(logits) 
        return capacity_map


if __name__ == "__main__":
    print(" Booting CamouflageNet...")
    model = CamouflageNet()
    
    # batch size of 2, 3 color channels, 256X256 image size
    dummy_input = torch.randn(2, 3, 256, 256) 
    output = model(dummy_input)
    
    print(f"Input Cover Image Shape: {dummy_input.shape}")
    print(f"Output Capacity Map Shape: {output.shape}")
    print(" The AI brain is structurally sound!")