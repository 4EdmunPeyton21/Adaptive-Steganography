import torch
import torch.nn as nn

class Steganalyzer(nn.Module):
    """
    The Discriminator (Police Officer): 
    Optimized to detect statistical anomalies in 1-channel AI Heatmaps.
    Output: 0.0 (Clean/Natural) to 1.0 (Suspicious/Artificial).
    """
    def __init__(self):
        super(Steganalyzer, self).__init__()
        
        # Feature Extraction Layers
        self.features = nn.Sequential(
            # Input is now 1 channel (Heatmap) instead of 3 (RGB)
            # This fixes the 'expected input[2, 1, 256, 256] to have 3 channels' error
            nn.Conv2d(1, 32, 4, 2, 1, bias=False), 
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.Conv2d(32, 64, 4, 2, 1, bias=False),
            nn.BatchNorm2d(64),
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.Conv2d(64, 128, 4, 2, 1, bias=False),
            nn.BatchNorm2d(128),
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.Conv2d(128, 256, 4, 2, 1, bias=False),
            nn.BatchNorm2d(256),
            nn.LeakyReLU(0.2, inplace=True),
        )
        
        # Final Classification Head
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d(1), # Squashes spatial grid into 1x1
            nn.Flatten(),            # Converts to single vector
            nn.Linear(256, 1),       # Maps features to one suspicion score
            nn.Sigmoid()             # Constrains score between 0.0 and 1.0
        )

    def forward(self, x):
        """
        Processes the input. If a 3-channel RGB image is passed, 
        it automatically converts it to grayscale to match the 1-channel expectation.
        """
        # Handling unexpected 3-channel RGB inputs via Grayscale conversion
        if x.shape[1] == 3:
            # Standard Luminosity formula: Y = 0.299R + 0.587G + 0.114B
            x = 0.2989 * x[:, 0:1, :, :] + 0.5870 * x[:, 1:2, :, :] + 0.1140 * x[:, 2:3, :, :]
        
        x = self.features(x)
        return self.classifier(x)

if __name__ == "__main__":
    # Test initialization
    model = Steganalyzer()
    test_input = torch.randn(1, 1, 256, 256)
    output = model(test_input)
    print(f"Steganalyzer initialized successfully.")
    print(f"Output shape: {output.shape} (Expected: [1, 1])")