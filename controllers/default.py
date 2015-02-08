import logging
import pdb

def index():
    response.view = "hello.html"
    return dict(item="woof")